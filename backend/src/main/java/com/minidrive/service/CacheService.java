package com.minidrive.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Redis caching service for folder structures and thumbnails.
 * Does NOT cache video chunks (too large).
 */
@Service
public class CacheService {

    private static final Logger logger = LoggerFactory.getLogger(CacheService.class);
    
    private static final String FOLDER_CONTENT_PREFIX = "folder:content:";
    private static final String THUMBNAIL_PREFIX = "thumbnail:";
    private static final long FOLDER_CACHE_TTL_MINUTES = 30;
    private static final long THUMBNAIL_CACHE_TTL_HOURS = 24;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    // ==================== FOLDER CONTENT CACHING ====================

    /**
     * Cache folder contents (files + folders list)
     */
    public void cacheFolderContent(String username, String folderId, Map<String, Object> content) {
        String key = buildFolderKey(username, folderId);
        try {
            redisTemplate.opsForValue().set(key, content, FOLDER_CACHE_TTL_MINUTES, TimeUnit.MINUTES);
            logger.debug("Cached folder content: {}", key);
        } catch (Exception e) {
            logger.warn("Failed to cache folder content: {}", e.getMessage());
        }
    }

    /**
     * Get cached folder contents
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getCachedFolderContent(String username, String folderId) {
        String key = buildFolderKey(username, folderId);
        try {
            Object cached = redisTemplate.opsForValue().get(key);
            if (cached != null) {
                logger.debug("Cache hit for folder: {}", key);
                return (Map<String, Object>) cached;
            }
        } catch (Exception e) {
            logger.warn("Failed to retrieve cached folder: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Invalidate folder cache on write/delete
     */
    public void invalidateFolderCache(String username, String folderId) {
        String key = buildFolderKey(username, folderId);
        try {
            redisTemplate.delete(key);
            logger.debug("Invalidated folder cache: {}", key);
        } catch (Exception e) {
            logger.warn("Failed to invalidate cache: {}", e.getMessage());
        }
    }

    /**
     * Invalidate all folder caches for a user (on major operations)
     */
    public void invalidateUserFolderCaches(String username) {
        String pattern = FOLDER_CONTENT_PREFIX + username + ":*";
        try {
            var keys = redisTemplate.keys(pattern);
            if (keys != null && !keys.isEmpty()) {
                redisTemplate.delete(keys);
                logger.debug("Invalidated {} folder caches for user: {}", keys.size(), username);
            }
        } catch (Exception e) {
            logger.warn("Failed to invalidate user caches: {}", e.getMessage());
        }
    }

    // ==================== THUMBNAIL CACHING ====================

    /**
     * Cache thumbnail binary data
     */
    public void cacheThumbnail(String fileId, byte[] thumbnailData) {
        String key = THUMBNAIL_PREFIX + fileId;
        try {
            redisTemplate.opsForValue().set(key, thumbnailData, THUMBNAIL_CACHE_TTL_HOURS, TimeUnit.HOURS);
            logger.debug("Cached thumbnail: {}", fileId);
        } catch (Exception e) {
            logger.warn("Failed to cache thumbnail: {}", e.getMessage());
        }
    }

    /**
     * Get cached thumbnail
     */
    public byte[] getCachedThumbnail(String fileId) {
        String key = THUMBNAIL_PREFIX + fileId;
        try {
            Object cached = redisTemplate.opsForValue().get(key);
            if (cached instanceof byte[]) {
                logger.debug("Thumbnail cache hit: {}", fileId);
                return (byte[]) cached;
            }
        } catch (Exception e) {
            logger.warn("Failed to retrieve cached thumbnail: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Invalidate thumbnail cache
     */
    public void invalidateThumbnail(String fileId) {
        String key = THUMBNAIL_PREFIX + fileId;
        try {
            redisTemplate.delete(key);
        } catch (Exception e) {
            logger.warn("Failed to invalidate thumbnail: {}", e.getMessage());
        }
    }

    // ==================== HELPERS ====================

    private String buildFolderKey(String username, String folderId) {
        return FOLDER_CONTENT_PREFIX + username + ":" + (folderId != null ? folderId : "root");
    }
}
