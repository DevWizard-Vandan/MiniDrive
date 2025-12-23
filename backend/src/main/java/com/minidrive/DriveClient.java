package com.minidrive;

import com.google.protobuf.ByteString;
import com.minidrive.grpc.*;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.stub.StreamObserver;

import java.io.File;
import java.io.FileInputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public class DriveClient {

	// Set chunk size to 1MB (You can tune this)
	private static final int CHUNK_SIZE = 1 * 1024 * 1024;

	public static void main(String[] args) throws Exception {
		// 1. Setup Connection
		ManagedChannel channel = ManagedChannelBuilder.forAddress("localhost", 50051)
				.usePlaintext() // No SSL for local dev
				.build();

		// We need two types of "stubs" (clients):
		// BlockingStub: For simple Request -> Response calls
		DriveServiceGrpc.DriveServiceBlockingStub blockingStub = DriveServiceGrpc.newBlockingStub(channel);
		// AsyncStub: For the Streaming Upload
		DriveServiceGrpc.DriveServiceStub asyncStub = DriveServiceGrpc.newStub(channel);

		// 2. Select a file to upload (Change this path to a real file on your PC!)
		File file = new File("src/main/resources/test_video.mp4");

		// (Create a dummy file if it doesn't exist just to test)
		if (!file.exists()) {
			System.err.println("File not found! Creating a dummy file for testing...");
			file = new File("test_upload.txt");
			java.nio.file.Files.writeString(file.toPath(), "Hello World! ".repeat(100000));
		}

		System.out.println("--- Step 1: Initiating Upload ---");
		UploadRequest initReq = UploadRequest.newBuilder()
				.setFilename(file.getName())
				.setMimeType("application/octet-stream")
				.setTotalSizeBytes(file.length())
				.build();
		UploadResponse initResp = blockingStub.initiateUpload(initReq);
		String uploadId = initResp.getUploadId();
		System.out.println("Upload ID received: " + uploadId);

		// 3. Pre-process: Calculate Hashes
		System.out.println("--- Step 2: Hashing File Chunks ---");
		List<String> allHashes = new ArrayList<>();
		byte[] buffer = new byte[CHUNK_SIZE];
		try (FileInputStream fis = new FileInputStream(file)) {
			int bytesRead;
			while ((bytesRead = fis.read(buffer)) != -1) {
				// If last chunk is smaller, trim the buffer
				byte[] actualData = Arrays.copyOf(buffer, bytesRead);
				allHashes.add(calculateHash(actualData));
			}
		}
		System.out.println("Calculated " + allHashes.size() + " chunk hashes.");

		// 4. The "Twist": Check Deduplication
		System.out.println("--- Step 3: Checking Existence (Deduplication) ---");
		ChunkCheckRequest checkReq = ChunkCheckRequest.newBuilder()
				.setUploadId(uploadId)
				.addAllChunkHashes(allHashes)
				.build();

		ChunkCheckResponse checkResp = blockingStub.checkChunkExistence(checkReq);
		List<Integer> missingIndices = checkResp.getMissingChunkIndicesList();

		System.out.println("Server needs " + missingIndices.size() + " out of " + allHashes.size() + " chunks.");
		if (missingIndices.isEmpty()) {
			System.out.println(">> INSTANT UPLOAD! Server already has all data.");
		}

		// 5. Upload ONLY missing chunks
		if (!missingIndices.isEmpty()) {
			System.out.println("--- Step 4: Streaming Missing Chunks ---");

			// Latch allows us to wait for the async upload to finish
			CountDownLatch finishLatch = new CountDownLatch(1);

			StreamObserver<ChunkData> requestObserver = asyncStub.uploadChunk(new StreamObserver<UploadStatus>() {
				@Override
				public void onNext(UploadStatus status) {
					System.out.println("Server Status: " + status.getMessage());
				}

				@Override
				public void onError(Throwable t) {
					System.err.println("Upload Error: " + t.getMessage());
					finishLatch.countDown();
				}

				@Override
				public void onCompleted() {
					System.out.println("Streaming Finished.");
					finishLatch.countDown();
				}
			});

			// Re-read file and send ONLY missing chunks
			try (FileInputStream fis = new FileInputStream(file)) {
				int bytesRead;
				int currentIndex = 0;
				while ((bytesRead = fis.read(buffer)) != -1) {
					if (missingIndices.contains(currentIndex)) {
						System.out.print("Uploading Chunk " + currentIndex + "... ");

						byte[] actualData = Arrays.copyOf(buffer, bytesRead);
						String hash = allHashes.get(currentIndex);

						ChunkData chunk = ChunkData.newBuilder()
								.setUploadId(uploadId)
								.setChunkIndex(currentIndex)
								.setChunkHash(hash)
								.setData(ByteString.copyFrom(actualData))
								.build();

						requestObserver.onNext(chunk);
						System.out.println("Sent.");
					} else {
						System.out.println("Skipping Chunk " + currentIndex + " (Deduped)");
					}
					currentIndex++;
				}
			}

			// Mark stream as completed
			requestObserver.onCompleted();
			// Wait for server to say "OK"
			finishLatch.await(1, TimeUnit.MINUTES);
		}

		// 6. Finalize
		System.out.println("--- Step 5: Finalizing ---");
		CompleteRequest compReq = CompleteRequest.newBuilder().setUploadId(uploadId).build();
		FileMetadata metadata = blockingStub.completeUpload(compReq);
		System.out.println("Success! File URL: " + metadata.getUrl());

		channel.shutdownNow();
	}

	// Helper: SHA-256 Hashing
	private static String calculateHash(byte[] data) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			byte[] hash = digest.digest(data);
			StringBuilder hexString = new StringBuilder();
			for (byte b : hash) {
				String hex = Integer.toHexString(0xff & b);
				if (hex.length() == 1) hexString.append('0');
				hexString.append(hex);
			}
			return hexString.toString();
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
	}
}