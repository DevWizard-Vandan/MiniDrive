package com.minidrive.service;

import com.minidrive.grpc.*;
import com.minidrive.storage.StorageService;
import com.minidrive.db.DatabaseService;
import io.grpc.stub.StreamObserver;
import com.minidrive.grpc.FileMetadata;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class DriveServiceImpl extends DriveServiceGrpc.DriveServiceImplBase {

	private final StorageService storageService;
	private final DatabaseService databaseService;

	// Temporary session state (while uploading, before finalizing)
	// Key: UploadID -> Value: Metadata (Name, Size, etc.)
	private static final Map<String, UploadRequest> CURRENT_UPLOADS = new ConcurrentHashMap<>();

	// Key: UploadID -> List of Ordered Hashes (to reconstruction later)
	private static final Map<String, List<String>> UPLOAD_CHUNKS_MAP = new ConcurrentHashMap<>();

	public DriveServiceImpl() {
		this.storageService = new StorageService();
		this.databaseService = new DatabaseService();
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
			// It's possible DB says yes but file was deleted from disk manually.
			boolean dbHasIt = databaseService.hasChunk(hash);
			boolean storageHasIt = false;

			// Optimization: Only check MinIO if DB says we don't have it (or periodically)
			// For safety, we trust the DB for now to be fast.

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
				// We check storageService again to be safe against race conditions
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

		// 3. Cleanup Memory
		CURRENT_UPLOADS.remove(uploadId);
		UPLOAD_CHUNKS_MAP.remove(uploadId);

		System.out.println("File Finalized: " + originalInfo.getFilename());

		FileMetadata metadata = FileMetadata.newBuilder()
				.setFileId(newFileId)
				.setVersion(1)
				.setUrl("http://localhost:9000/drive-chunks/" + orderedHashes.get(0)) // Link to first chunk for demo
				.build();

		responseObserver.onNext(metadata);
		responseObserver.onCompleted();
	}
}