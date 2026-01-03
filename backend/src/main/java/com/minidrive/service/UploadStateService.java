package com.minidrive.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Redis-backed upload session state management.
 * Enables horizontal scaling and resumable uploads across service restarts.
 */
@Service
public class UploadStateService {

    private static final Logger logger = LoggerFactory.getLogger(UploadStateService.class);

    private static final String UPLOAD_META_PREFIX = "upload:meta:";
    private static final String UPLOAD_CHUNKS_PREFIX = "upload:chunks:";
    private static final long UPLOAD_SESSION_TTL_HOURS = 24; // Sessions expire after 24h

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    // ==================== DATA CLASSES ====================

    public record UploadMetadata(String filename, long size, String folderId, String username) {}

    // ==================== SESSION MANAGEMENT ====================

    /**
     * Initialize a new upload session
     */
    public void initSession(String uploadId, String filename, long size, String folderId, String username) {
        String metaKey = UPLOAD_META_PREFIX + uploadId;
        String chunksKey = UPLOAD_CHUNKS_PREFIX + uploadId;

        try {
            UploadMetadata metadata = new UploadMetadata(filename, size, folderId, username);
            redisTemplate.opsForValue().set(metaKey, metadata, UPLOAD_SESSION_TTL_HOURS, TimeUnit.HOURS);
            
            // Initialize empty hash for chunk tracking
            redisTemplate.opsForHash().put(chunksKey, "__init__", "true");
            redisTemplate.expire(chunksKey, UPLOAD_SESSION_TTL_HOURS, TimeUnit.HOURS);
            
            logger.info("Upload session created: {} for file '{}'", uploadId, filename);
        } catch (Exception e) {
            logger.error("Failed to init upload session: {}", e.getMessage());
            throw new RuntimeException("Failed to initialize upload session", e);
        }
    }

    /**
     * Register a chunk in the upload session
     */
    public void registerChunk(String uploadId, int index, String chunkHash) {
        String chunksKey = UPLOAD_CHUNKS_PREFIX + uploadId;
        try {
            redisTemplate.opsForHash().put(chunksKey, String.valueOf(index), chunkHash);
            logger.debug("Registered chunk {} for upload {}", index, uploadId);
        } catch (Exception e) {
            logger.error("Failed to register chunk: {}", e.getMessage());
            throw new RuntimeException("Failed to register chunk", e);
        }
    }

    /**
     * Get upload metadata
     */
    public UploadMetadata getMetadata(String uploadId) {
        String metaKey = UPLOAD_META_PREFIX + uploadId;
        try {
            Object cached = redisTemplate.opsForValue().get(metaKey);
            if (cached instanceof UploadMetadata) {
                return (UploadMetadata) cached;
            }
            // Handle LinkedHashMap deserialization from JSON
            if (cached instanceof java.util.Map) {
                @SuppressWarnings("unchecked")
                java.util.Map<String, Object> map = (java.util.Map<String, Object>) cached;
                return new UploadMetadata(
                    (String) map.get("filename"),
                    ((Number) map.get("size")).longValue(),
                    (String) map.get("folderId"),
                    (String) map.get("username")
                );
            }
        } catch (Exception e) {
            logger.error("Failed to get upload metadata: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Get all chunk hashes for an upload, ordered by index
     */
    public List<String> getChunkHashes(String uploadId) {
        String chunksKey = UPLOAD_CHUNKS_PREFIX + uploadId;
        try {
            var entries = redisTemplate.opsForHash().entries(chunksKey);
            if (entries.isEmpty()) {
                return null;
            }

            // Find max index to size the list
            int maxIndex = entries.keySet().stream()
                .filter(k -> !k.equals("__init__"))
                .mapToInt(k -> Integer.parseInt((String) k))
                .max()
                .orElse(-1);

            if (maxIndex < 0) {
                return new ArrayList<>();
            }

            List<String> hashes = new ArrayList<>(maxIndex + 1);
            for (int i = 0; i <= maxIndex; i++) {
                hashes.add(null);
            }

            entries.forEach((key, value) -> {
                if (!"__init__".equals(key)) {
                    int idx = Integer.parseInt((String) key);
                    hashes.set(idx, (String) value);
                }
            });

            return hashes;
        } catch (Exception e) {
            logger.error("Failed to get chunk hashes: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Check if session exists
     */
    public boolean sessionExists(String uploadId) {
        String metaKey = UPLOAD_META_PREFIX + uploadId;
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(metaKey));
        } catch (Exception e) {
            logger.warn("Failed to check session existence: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Clean up session after completion or failure
     */
    public void cleanupSession(String uploadId) {
        String metaKey = UPLOAD_META_PREFIX + uploadId;
        String chunksKey = UPLOAD_CHUNKS_PREFIX + uploadId;
        try {
            redisTemplate.delete(metaKey);
            redisTemplate.delete(chunksKey);
            logger.info("Upload session cleaned up: {}", uploadId);
        } catch (Exception e) {
            logger.warn("Failed to cleanup session: {}", e.getMessage());
        }
    }

    /**
     * Get upload progress (for resumable uploads)
     */
    public int getUploadedChunkCount(String uploadId) {
        String chunksKey = UPLOAD_CHUNKS_PREFIX + uploadId;
        try {
            Long size = redisTemplate.opsForHash().size(chunksKey);
            return size != null ? (int) (size - 1) : 0; // Subtract 1 for __init__ marker
        } catch (Exception e) {
            return 0;
        }
    }
}
