package com.minidrive.storage;

import com.minidrive.service.EncryptionService;
import io.minio.*;
import io.minio.errors.ErrorResponseException;
import io.minio.messages.Item;
import io.minio.messages.VersioningConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.*;

/**
 * MinIO storage service with optional AES-256-GCM encryption.
 * 
 * Zero-Knowledge Architecture:
 * - Chunks are encrypted BEFORE leaving the JVM
 * - MinIO only stores encrypted blobs
 * - Decryption happens on download, inside the JVM
 * 
 * For backwards compatibility, methods without SecretKey continue to work
 * (unencrypted storage for legacy data or when encryption is disabled).
 * 
 * File Versioning:
 * - Uses a separate versioned bucket for complete files
 * - MinIO native versioning preserves all previous versions
 */
@Service
public class StorageService {

    private static final Logger logger = LoggerFactory.getLogger(StorageService.class);

    private final MinioClient minioClient;
    private static final String BUCKET_NAME = "drive-chunks";
    private static final String VERSIONED_BUCKET = "drive-files-versioned";

    @Autowired
    private EncryptionService encryptionService;

    @Autowired
    public StorageService(MinioClient minioClient) {
        this.minioClient = minioClient;
        initializeBucket();
        initializeVersionedBucket();
    }

    private void initializeBucket() {
        try {
            boolean found = minioClient.bucketExists(BucketExistsArgs.builder().bucket(BUCKET_NAME).build());
            if (!found) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(BUCKET_NAME).build());
                logger.info("Storage: Created new bucket '{}'", BUCKET_NAME);
            } else {
                logger.info("Storage: Connected to bucket '{}'", BUCKET_NAME);
            }
        } catch (Exception e) {
            throw new RuntimeException("Storage initialization failed: " + e.getMessage(), e);
        }
    }

    /**
     * Initialize the versioned bucket with MinIO native versioning enabled.
     */
    private void initializeVersionedBucket() {
        try {
            boolean found = minioClient.bucketExists(BucketExistsArgs.builder().bucket(VERSIONED_BUCKET).build());
            if (!found) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(VERSIONED_BUCKET).build());
                logger.info("Storage: Created versioned bucket '{}'", VERSIONED_BUCKET);
            }

            // Enable versioning on the bucket
            minioClient.setBucketVersioning(
                SetBucketVersioningArgs.builder()
                    .bucket(VERSIONED_BUCKET)
                    .config(new VersioningConfiguration(VersioningConfiguration.Status.ENABLED, false))
                    .build()
            );
            logger.info("Storage: Versioning enabled on bucket '{}'", VERSIONED_BUCKET);

        } catch (Exception e) {
            logger.warn("Versioned bucket initialization failed (versioning may not be available): {}", e.getMessage());
        }
    }

    // ==================== VERSIONED FILE OPERATIONS ====================

    /**
     * Upload a complete file to the versioned bucket.
     * MinIO will automatically create a new version for existing objects.
     * 
     * @param objectKey Unique file identifier (e.g., user/filename)
     * @param data File content
     * @param contentType MIME type
     * @return Version ID assigned by MinIO
     */
    public String uploadVersionedFile(String objectKey, byte[] data, String contentType) {
        try (InputStream stream = new ByteArrayInputStream(data)) {
            ObjectWriteResponse response = minioClient.putObject(
                PutObjectArgs.builder()
                    .bucket(VERSIONED_BUCKET)
                    .object(objectKey)
                    .stream(stream, data.length, -1)
                    .contentType(contentType != null ? contentType : "application/octet-stream")
                    .build()
            );
            logger.info("Uploaded versioned file: {} (version: {})", objectKey, response.versionId());
            return response.versionId();
        } catch (Exception e) {
            throw new RuntimeException("Failed to upload versioned file: " + objectKey, e);
        }
    }

    /**
     * Download a specific version of a file.
     * 
     * @param objectKey File identifier
     * @param versionId Version ID (null for latest)
     * @return File content
     */
    public byte[] downloadVersionedFile(String objectKey, String versionId) {
        try {
            GetObjectArgs.Builder builder = GetObjectArgs.builder()
                .bucket(VERSIONED_BUCKET)
                .object(objectKey);
            
            if (versionId != null && !versionId.isEmpty()) {
                builder.versionId(versionId);
            }
            
            try (InputStream stream = minioClient.getObject(builder.build())) {
                return stream.readAllBytes();
            }
        } catch (Exception e) {
            logger.error("Failed to download versioned file {}: {}", objectKey, e.getMessage());
            return new byte[0];
        }
    }

    /**
     * List all versions of a file.
     * 
     * @param objectKey File identifier
     * @return List of version info maps (versionId, size, lastModified, isLatest)
     */
    public List<Map<String, Object>> listVersions(String objectKey) {
        List<Map<String, Object>> versions = new ArrayList<>();
        try {
            Iterable<io.minio.Result<Item>> results = minioClient.listObjects(
                ListObjectsArgs.builder()
                    .bucket(VERSIONED_BUCKET)
                    .prefix(objectKey)
                    .includeVersions(true)
                    .build()
            );

            for (io.minio.Result<Item> result : results) {
                Item item = result.get();
                if (item.objectName().equals(objectKey)) {
                    Map<String, Object> version = new HashMap<>();
                    version.put("versionId", item.versionId());
                    version.put("size", item.size());
                    version.put("lastModified", item.lastModified().toString());
                    version.put("isLatest", item.isLatest());
                    versions.add(version);
                }
            }
        } catch (Exception e) {
            logger.error("Failed to list versions for {}: {}", objectKey, e.getMessage());
        }
        return versions;
    }

    /**
     * Delete a specific version of a file.
     * 
     * @param objectKey File identifier
     * @param versionId Version to delete
     */
    public void deleteVersion(String objectKey, String versionId) {
        try {
            minioClient.removeObject(
                RemoveObjectArgs.builder()
                    .bucket(VERSIONED_BUCKET)
                    .object(objectKey)
                    .versionId(versionId)
                    .build()
            );
            logger.info("Deleted version {} of {}", versionId, objectKey);
        } catch (Exception e) {
            logger.error("Failed to delete version: {}", e.getMessage());
        }
    }

    // ==================== ENCRYPTED OPERATIONS (Zero-Knowledge) ====================

    /**
     * Upload a chunk with AES-256-GCM encryption.
     * The chunk is encrypted before it leaves the JVM - MinIO never sees plaintext.
     * 
     * @param chunkHash Content-addressed hash (used as object key)
     * @param data Raw chunk data
     * @param userKey User's decrypted DEK
     */
    public void uploadChunkEncrypted(String chunkHash, byte[] data, SecretKey userKey) {
        byte[] encryptedData = encryptionService.encryptChunk(data, userKey);
        uploadRaw(chunkHash, encryptedData);
        logger.debug("Uploaded encrypted chunk: {} ({} bytes -> {} bytes)", 
            chunkHash, data.length, encryptedData.length);
    }

    /**
     * Download and decrypt a chunk.
     * 
     * @param chunkHash Content-addressed hash
     * @param userKey User's decrypted DEK
     * @return Decrypted plaintext chunk
     */
    public byte[] downloadChunkEncrypted(String chunkHash, SecretKey userKey) {
        byte[] encryptedData = downloadRaw(chunkHash);
        if (encryptedData.length == 0) {
            return encryptedData;
        }
        return encryptionService.decryptChunk(encryptedData, userKey);
    }

    // ==================== RAW OPERATIONS (Legacy/Unencrypted) ====================

    /**
     * Upload a chunk without encryption.
     * Kept for backwards compatibility and gradual migration.
     */
    public void uploadChunk(String chunkHash, byte[] data) {
        uploadRaw(chunkHash, data);
    }

    /**
     * Download a chunk without decryption.
     * For legacy unencrypted data.
     */
    public byte[] downloadChunk(String chunkHash) {
        return downloadRaw(chunkHash);
    }

    // ==================== INTERNAL MINIO OPERATIONS ====================

    private void uploadRaw(String objectKey, byte[] data) {
        try (InputStream stream = new ByteArrayInputStream(data)) {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(BUCKET_NAME)
                            .object(objectKey)
                            .stream(stream, data.length, -1)
                            .contentType("application/octet-stream")
                            .build()
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to upload chunk " + objectKey, e);
        }
    }

    private byte[] downloadRaw(String objectKey) {
        try (InputStream stream = minioClient.getObject(
                GetObjectArgs.builder()
                        .bucket(BUCKET_NAME)
                        .object(objectKey)
                        .build())) {
            return stream.readAllBytes();
        } catch (Exception e) {
            logger.error("Failed to download chunk {}: {}", objectKey, e.getMessage());
            return new byte[0];
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
}