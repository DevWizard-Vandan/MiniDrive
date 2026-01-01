package com.minidrive.storage;

import io.minio.*;
import io.minio.errors.ErrorResponseException;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

@Service
public class StorageService {

	private final MinioClient minioClient;
	private static final String BUCKET_NAME = "drive-chunks";

	public StorageService() {
		// Connect to MinIO
		this.minioClient = MinioClient.builder()
				.endpoint("http://localhost:9000")
				.credentials("minioadmin", "minioadmin")
				.build();

		initializeBucket();
	}

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

	public void uploadChunk(String chunkHash, byte[] data) {
		try (InputStream stream = new ByteArrayInputStream(data)) {
			minioClient.putObject(
					PutObjectArgs.builder()
							.bucket(BUCKET_NAME)
							.object(chunkHash)
							.stream(stream, data.length, -1)
							.contentType("application/octet-stream")
							.build()
			);
		} catch (Exception e) {
			throw new RuntimeException("Failed to upload chunk " + chunkHash, e);
		}
	}

	public boolean doesChunkExist(String chunkHash) {
		try {
			minioClient.statObject(StatObjectArgs.builder().bucket(BUCKET_NAME).object(chunkHash).build());
			return true;
		} catch (ErrorResponseException e) {
			if (e.errorResponse().code().equals("NoSuchKey")) return false;
			throw new RuntimeException("Error checking chunk", e);
		} catch (Exception e) {
			throw new RuntimeException("Error checking chunk", e);
		}
	}

	/**
	 * Downloads a raw chunk from MinIO.
	 * Used for file re-assembly and Zip generation.
	 */
	public byte[] downloadChunk(String chunkHash) {
		try (InputStream stream = minioClient.getObject(
				GetObjectArgs.builder()
						.bucket(BUCKET_NAME) // Fixed variable name here
						.object(chunkHash)
						.build())) {
			return stream.readAllBytes();
		} catch (Exception e) {
			e.printStackTrace();
			return new byte[0]; // Return empty byte array to prevent Zip stream crash
		}
	}
}