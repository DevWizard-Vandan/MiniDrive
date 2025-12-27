package com.minidrive.service;

import com.minidrive.grpc.*;
import com.minidrive.storage.StorageService;
import com.minidrive.db.DatabaseService;
import io.grpc.stub.StreamObserver;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class DriveServiceImpl extends DriveServiceGrpc.DriveServiceImplBase {

	@Autowired
	private StorageService storageService;

	@Autowired
	private DatabaseService databaseService;

	@Autowired
	private RabbitTemplate rabbitTemplate;

	// Maps
	private static final Map<String, String> UPLOAD_FOLDER_MAP = new ConcurrentHashMap<>();
	private static final Map<String, UploadRequest> CURRENT_UPLOADS = new ConcurrentHashMap<>();
	private static final Map<String, List<String>> UPLOAD_CHUNKS_MAP = new ConcurrentHashMap<>();

	public DriveServiceImpl() {
		// Empty constructor (Spring handles injection)
	}

	// --- 1. Manual Init for REST Controller ---
	public void manualInit(String uploadId, String filename, long size, String folderId) {
		UploadRequest request = UploadRequest.newBuilder().setFilename(filename).setTotalSizeBytes(size).build();
		CURRENT_UPLOADS.put(uploadId, request);
		UPLOAD_CHUNKS_MAP.put(uploadId, new ArrayList<>());
		if (folderId != null) {
			UPLOAD_FOLDER_MAP.put(uploadId, folderId);
		}
		System.out.println("Init Upload: " + filename + " [" + uploadId + "] Folder: " + folderId);
	}

	// --- 2. Standard gRPC Init ---
	@Override
	public void initiateUpload(UploadRequest request, StreamObserver<UploadResponse> responseObserver) {
		String uploadId = UUID.randomUUID().toString();

		CURRENT_UPLOADS.put(uploadId, request);
		UPLOAD_CHUNKS_MAP.put(uploadId, new ArrayList<>());

		System.out.println("Start Upload (gRPC): " + request.getFilename() + " [" + uploadId + "]");

		UploadResponse response = UploadResponse.newBuilder().setUploadId(uploadId).build();
		responseObserver.onNext(response);
		responseObserver.onCompleted();
	}

	// Helper to set folder (if coming from gRPC side later)
	public void setUploadFolder(String uploadId, String folderId) {
		if (folderId != null) {
			UPLOAD_FOLDER_MAP.put(uploadId, folderId);
		}
	}

	// --- 3. Chunk Check (Deduplication) ---
	@Override
	public void checkChunkExistence(ChunkCheckRequest request, StreamObserver<ChunkCheckResponse> responseObserver) {
		List<Integer> missingIndices = new ArrayList<>();
		List<String> incomingHashes = request.getChunkHashesList();

		UPLOAD_CHUNKS_MAP.put(request.getUploadId(), new ArrayList<>(incomingHashes));

		for (int i = 0; i < incomingHashes.size(); i++) {
			String hash = incomingHashes.get(i);
			boolean dbHasIt = databaseService.hasChunk(hash); // Hybrid Check

			if (!dbHasIt) {
				missingIndices.add(i);
			} else {
				// System.out.println(">> Dedup: Chunk " + i + " exists globally.");
			}
		}

		ChunkCheckResponse response = ChunkCheckResponse.newBuilder()
				.addAllMissingChunkIndices(missingIndices)
				.build();
		responseObserver.onNext(response);
		responseObserver.onCompleted();
	}

	// --- 4. Upload Stream ---
	@Override
	public StreamObserver<ChunkData> uploadChunk(StreamObserver<UploadStatus> responseObserver) {
		return new StreamObserver<ChunkData>() {
			@Override
			public void onNext(ChunkData chunk) {
				String hash = chunk.getChunkHash();
				byte[] data = chunk.getData().toByteArray();

				if (!storageService.doesChunkExist(hash)) {
					storageService.uploadChunk(hash, data);
					// System.out.println("Uploaded Chunk #" + chunk.getChunkIndex());
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

	// --- 5. Finalization (FIXED) ---
	@Override
	public void completeUpload(CompleteRequest request, StreamObserver<FileMetadata> responseObserver) {
		String uploadId = request.getUploadId();

		// Retrieve Session Data
		UploadRequest originalInfo = CURRENT_UPLOADS.get(uploadId);
		List<String> orderedHashes = UPLOAD_CHUNKS_MAP.get(uploadId);

		// 1. SAFETY CHECK (Must be first)
		if (originalInfo == null || orderedHashes == null) {
			responseObserver.onError(new RuntimeException("Upload session not found! ID: " + uploadId));
			return;
		}

		// 2. Context Data
		String username = SecurityContextHolder.getContext().getAuthentication().getName();
		String newFileId = UUID.randomUUID().toString();
		String folderId = UPLOAD_FOLDER_MAP.get(uploadId); // Get Folder ID

		// 3. Save Metadata (Single Call)
		databaseService.saveFileMetadata(newFileId, originalInfo.getFilename(), originalInfo.getTotalSizeBytes(), username, folderId);

		// 4. Link Chunks
		for (int i = 0; i < orderedHashes.size(); i++) {
			databaseService.addChunkToFile(newFileId, orderedHashes.get(i), i);
		}

		// 5. RabbitMQ Event
		if (rabbitTemplate != null) {
			String message = "FILE_ID:" + newFileId + "|NAME:" + originalInfo.getFilename();
			try {
				rabbitTemplate.convertAndSend("file-processing-queue", message);
				System.out.println("⚡ EVENT: Sent to RabbitMQ: " + message);
			} catch (Exception e) {
				System.err.println("⚠️ RabbitMQ Error: " + e.getMessage());
			}
		}

		// 6. Cleanup Memory
		CURRENT_UPLOADS.remove(uploadId);
		UPLOAD_CHUNKS_MAP.remove(uploadId);
		UPLOAD_FOLDER_MAP.remove(uploadId);

		System.out.println("File Finalized: " + originalInfo.getFilename() + " (Folder: " + folderId + ")");

		// 7. Response
		FileMetadata metadata = FileMetadata.newBuilder()
				.setFileId(newFileId)
				.setVersion(1)
				.setUrl("http://localhost:9000/drive-chunks/" + orderedHashes.get(0))
				.build();

		responseObserver.onNext(metadata);
		responseObserver.onCompleted();
	}
}