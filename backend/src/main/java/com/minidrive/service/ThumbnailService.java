package com.minidrive.service;

import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import net.coobird.thumbnailator.Thumbnails;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Set;

/**
 * Thumbnail generation service.
 * Generates 200x200 thumbnails for images asynchronously.
 */
@Service
public class ThumbnailService {

    private static final Logger logger = LoggerFactory.getLogger(ThumbnailService.class);
    
    private static final int THUMBNAIL_SIZE = 200;
    private static final String THUMBNAIL_PREFIX = "thumbnails/";
    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(
        "jpg", "jpeg", "png", "gif", "webp", "bmp"
    );

    @Autowired
    private MinioClient minioClient;

    @Autowired
    private CacheService cacheService;

    @Value("${minio.bucket:user-uploads}")
    private String bucketName;

    /**
     * Check if file type supports thumbnail generation
     */
    public boolean supportsThumbnail(String filename) {
        if (filename == null) return false;
        String ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
        return SUPPORTED_EXTENSIONS.contains(ext);
    }

    /**
     * Generate thumbnail asynchronously after upload
     */
    @Async
    public void generateThumbnailAsync(String username, String fileId, String filename, String minioPath) {
        if (!supportsThumbnail(filename)) {
            return;
        }

        try {
            // Fetch original from MinIO
            InputStream originalStream = minioClient.getObject(
                GetObjectArgs.builder()
                    .bucket(bucketName)
                    .object(minioPath)
                    .build()
            );

            // Generate thumbnail
            ByteArrayOutputStream thumbnailOut = new ByteArrayOutputStream();
            Thumbnails.of(originalStream)
                .size(THUMBNAIL_SIZE, THUMBNAIL_SIZE)
                .outputFormat("jpg")
                .outputQuality(0.8)
                .toOutputStream(thumbnailOut);

            byte[] thumbnailBytes = thumbnailOut.toByteArray();
            
            // Store in MinIO under thumbnails/ prefix
            String thumbnailPath = THUMBNAIL_PREFIX + username + "/" + fileId + ".jpg";
            minioClient.putObject(
                PutObjectArgs.builder()
                    .bucket(bucketName)
                    .object(thumbnailPath)
                    .stream(new ByteArrayInputStream(thumbnailBytes), thumbnailBytes.length, -1)
                    .contentType("image/jpeg")
                    .build()
            );

            // Cache in Redis for instant grid rendering
            cacheService.cacheThumbnail(fileId, thumbnailBytes);

            logger.info("Generated thumbnail for file: {}", fileId);
        } catch (Exception e) {
            logger.error("Failed to generate thumbnail for {}: {}", fileId, e.getMessage());
        }
    }

    /**
     * Get thumbnail - check cache first, then MinIO
     */
    public byte[] getThumbnail(String username, String fileId) {
        // Check Redis cache first
        byte[] cached = cacheService.getCachedThumbnail(fileId);
        if (cached != null) {
            return cached;
        }

        // Fallback to MinIO
        try {
            String thumbnailPath = THUMBNAIL_PREFIX + username + "/" + fileId + ".jpg";
            InputStream stream = minioClient.getObject(
                GetObjectArgs.builder()
                    .bucket(bucketName)
                    .object(thumbnailPath)
                    .build()
            );
            
            byte[] data = stream.readAllBytes();
            
            // Cache for next time
            cacheService.cacheThumbnail(fileId, data);
            
            return data;
        } catch (Exception e) {
            logger.debug("No thumbnail found for: {}", fileId);
            return null;
        }
    }
}
