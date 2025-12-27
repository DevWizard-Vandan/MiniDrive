package com.minidrive.storage;

import io.minio.*;
import io.minio.errors.ErrorResponseException;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
@Service // <--- ADD THIS ANNOTATION
public class StorageService {

	private final MinioClient minioClient;
	private static final String BUCKET_NAME = "drive-chunks";

	public StorageService() {
		// 1. Connect to the Docker MinIO instance
		// Note: In production, these credentials should come from Environment Variables, not hardcoded strings.
		this.minioClient = MinioClient.builder()
				.endpoint("http://localhost:9000") // The API port, NOT the console port (9001)
				.credentials("minioadmin", "minioadmin")
				.build();

		initializeBucket();
	}

	// Ensure the bucket exists on startup
	private void initializeBucket() {
		try {
			boolean found = minioClient.bucketExists(BucketExistsArgs.builder().bucket(BUCKET_NAME).build());
			if (!found) {
				minioClient.makeBucket(MakeBucketArgs.builder().bucket(BUCKET_NAME).build());
				System.out.println("Storage: Created new bucket '" + BUCKET_NAME + "'");
			} else {
				System.out.println("Storage: Connected to bucket '" + BUCKET_NAME + "'");
			}
		} catch (Exception e) {
			throw new RuntimeException("Storage initialization failed: " + e.getMessage(), e);
		}
	}

	/**
	 * Uploads a chunk to MinIO.
	 * The "Chunk Hash" is used as the filename (Object Key).
	 * This creates a Content-Addressable Storage system.
	 */
	public void uploadChunk(String chunkHash, byte[] data) {
		try (InputStream stream = new ByteArrayInputStream(data)) {
			minioClient.putObject(
					PutObjectArgs.builder()
							.bucket(BUCKET_NAME)
							.object(chunkHash) // The filename is the hash!
							.stream(stream, data.length, -1)
							.contentType("application/octet-stream")
							.build()
			);
			// System.out.println(" -> Stored chunk: " + chunkHash); // verbose logging
		} catch (Exception e) {
			throw new RuntimeException("Failed to upload chunk " + chunkHash, e);
		}
	}

	/**
	 * Checks if a chunk physically exists in MinIO.
	 * This backs up our database/cache check for extra reliability.
	 */
	public boolean doesChunkExist(String chunkHash) {
		try {
			minioClient.statObject(
					StatObjectArgs.builder()
							.bucket(BUCKET_NAME)
							.object(chunkHash)
							.build()
			);
			return true;
		} catch (ErrorResponseException e) {
			if (e.errorResponse().code().equals("NoSuchKey")) {
				return false;
			}
			throw new RuntimeException("Error checking chunk existence", e);
		} catch (Exception e) {
			throw new RuntimeException("Error checking chunk existence", e);
		}
	}

	// Download a single chunk
	public byte[] downloadChunk(String hash) {
		try {
			return minioClient.getObject(
					GetObjectArgs.builder()
							.bucket(BUCKET_NAME)
							.object(hash)
							.build()
			).readAllBytes();
		} catch (Exception e) {
			throw new RuntimeException("Failed to fetch chunk: " + hash, e);
		}
	}
}