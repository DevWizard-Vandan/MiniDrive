package com.minidrive.service;

import com.minidrive.grpc.*;
import com.minidrive.storage.StorageService;
import com.minidrive.db.DatabaseService;
import io.grpc.stub.StreamObserver;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service // 1. Tells Spring to manage this class so we can use RabbitMQ
public class DriveServiceImpl extends DriveServiceGrpc.DriveServiceImplBase {

	@Autowired
	private StorageService storageService;

	@Autowired
	private DatabaseService databaseService;

	// 2. Inject RabbitMQ Template (Used to send messages)
	@Autowired
	private RabbitTemplate rabbitTemplate;

	// Temporary session state (while uploading, before finalizing)
	// Key: UploadID -> Value: Metadata (Name, Size, etc.)
	private static final Map<String, UploadRequest> CURRENT_UPLOADS = new ConcurrentHashMap<>();

	// Key: UploadID -> List of Ordered Hashes (to reconstruction later)
	private static final Map<String, List<String>> UPLOAD_CHUNKS_MAP = new ConcurrentHashMap<>();

	public DriveServiceImpl() {
//		this.storageService = new StorageService();
//		this.databaseService = new DatabaseService();
	}

	@Override
	public void initiateUpload(UploadRequest request, StreamObserver<UploadResponse> responseObserver) {
		String uploadId = UUID.randomUUID().toString();

		// Save session info
		CURRENT_UPLOADS.put(uploadId, request);
		UPLOAD_CHUNKS_MAP.put(uploadId, new ArrayList<>());

		System.out.println("Start Upload: " + request.getFilename() + " [" + uploadId + "]");

		UploadResponse response = UploadResponse.newBuilder().setUploadId(uploadId).build();
		responseObserver.onNext(response);
		responseObserver.onCompleted();
	}

	@Override
	public void checkChunkExistence(ChunkCheckRequest request, StreamObserver<ChunkCheckResponse> responseObserver) {
		List<Integer> missingIndices = new ArrayList<>();
		List<String> incomingHashes = request.getChunkHashesList();

		// Save the INTENDED order of chunks for this specific upload
		UPLOAD_CHUNKS_MAP.put(request.getUploadId(), new ArrayList<>(incomingHashes));

		for (int i = 0; i < incomingHashes.size(); i++) {
			String hash = incomingHashes.get(i);

			// HYBRID CHECK: Check DB (Metadata) AND MinIO (Physical Storage)
			boolean dbHasIt = databaseService.hasChunk(hash);

			if (!dbHasIt) {
				// We definitely need this chunk.
				missingIndices.add(i);
			} else {
				System.out.println(">> Dedup: Chunk " + i + " exists globally.");
			}
		}

		ChunkCheckResponse response = ChunkCheckResponse.newBuilder()
				.addAllMissingChunkIndices(missingIndices)
				.build();
		responseObserver.onNext(response);
		responseObserver.onCompleted();
	}

	@Override
	public StreamObserver<ChunkData> uploadChunk(StreamObserver<UploadStatus> responseObserver) {
		return new StreamObserver<ChunkData>() {
			@Override
			public void onNext(ChunkData chunk) {
				String hash = chunk.getChunkHash();
				byte[] data = chunk.getData().toByteArray();

				// 1. Upload to MinIO (The Physical Layer)
				if (!storageService.doesChunkExist(hash)) {
					storageService.uploadChunk(hash, data);
					System.out.println("Uploaded Chunk #" + chunk.getChunkIndex());
				} else {
					System.out.println("Skipped Upload #" + chunk.getChunkIndex() + " (Found in MinIO)");
				}
			}

			@Override
			public void onError(Throwable t) {
				System.err.println("Upload Stream Error: " + t.getMessage());
			}

			@Override
			public void onCompleted() {
				responseObserver.onNext(UploadStatus.newBuilder().setSuccess(true).setMessage("Done").build());
				responseObserver.onCompleted();
			}
		};
	}

	@Override
	public void completeUpload(CompleteRequest request, StreamObserver<FileMetadata> responseObserver) {
		String uploadId = request.getUploadId();
		UploadRequest originalInfo = CURRENT_UPLOADS.get(uploadId);
		List<String> orderedHashes = UPLOAD_CHUNKS_MAP.get(uploadId);

		if (originalInfo == null || orderedHashes == null) {
			responseObserver.onError(new RuntimeException("Upload session not found!"));
			return;
		}

		String newFileId = UUID.randomUUID().toString();

		// 1. Save File Info to Postgres
		databaseService.saveFileMetadata(newFileId, originalInfo.getFilename(), originalInfo.getTotalSizeBytes());

		// 2. Link File -> Chunks in Postgres
		for (int i = 0; i < orderedHashes.size(); i++) {
			databaseService.addChunkToFile(newFileId, orderedHashes.get(i), i);
		}

		// --- 3. NEW: FIRE EVENT TO RABBITMQ ---
		// We notify the worker queue that a file is ready for processing (Virus Scan/Thumbnail)
		if (rabbitTemplate != null) {
			String message = "FILE_ID:" + newFileId + "|NAME:" + originalInfo.getFilename();
			try {
				rabbitTemplate.convertAndSend("file-processing-queue", message);
				System.out.println("⚡ EVENT: Published upload event to RabbitMQ: " + message);
			} catch (Exception e) {
				System.err.println("⚠️ Warning: RabbitMQ is down, but file was saved. Error: " + e.getMessage());
			}
		} else {
			System.err.println("⚠️ Warning: RabbitTemplate is null. Did you use @Autowired in DriveController?");
		}
		// --------------------------------------

		// 4. Cleanup Memory
		CURRENT_UPLOADS.remove(uploadId);
		UPLOAD_CHUNKS_MAP.remove(uploadId);

		System.out.println("File Finalized: " + originalInfo.getFilename());

		FileMetadata metadata = FileMetadata.newBuilder()
				.setFileId(newFileId)
				.setVersion(1)
				.setUrl("http://localhost:9000/drive-chunks/" + orderedHashes.get(0))
				.build();

		responseObserver.onNext(metadata);
		responseObserver.onCompleted();
	}
}