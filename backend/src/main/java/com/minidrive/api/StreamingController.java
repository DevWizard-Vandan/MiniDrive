package com.minidrive.api;

import com.minidrive.db.DatabaseService;
import com.minidrive.service.ThumbnailService;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.InputStream;
import java.util.Map;

/**
 * Controller for streaming media with Range request support.
 * Enables video scrubbing without full download.
 */
@RestController
@RequestMapping("/api/stream")
public class StreamingController {

    private static final Logger logger = LoggerFactory.getLogger(StreamingController.class);

    @Autowired
    private MinioClient minioClient;

    @Autowired
    private DatabaseService databaseService;

    @Autowired
    private ThumbnailService thumbnailService;

    @Value("${minio.bucket:user-uploads}")
    private String bucketName;

    /**
     * Stream video with Range request support for scrubbing
     */
    @GetMapping("/video/{fileId}")
    public ResponseEntity<StreamingResponseBody> streamVideo(
            @PathVariable String fileId,
            @RequestHeader(value = "Range", required = false) String rangeHeader,
            @AuthenticationPrincipal UserDetails userDetails) {

        try {
            String username = userDetails.getUsername();
            
            // Get file metadata
            Map<String, Object> file = databaseService.getFileById(fileId, username);
            if (file == null) {
                return ResponseEntity.notFound().build();
            }

            String minioPath = (String) file.get("minio_path");
            String filename = (String) file.get("name");
            String contentType = getContentType(filename);

            // Get object stats for size
            StatObjectResponse stats = minioClient.statObject(
                StatObjectArgs.builder()
                    .bucket(bucketName)
                    .object(minioPath)
                    .build()
            );
            long fileSize = stats.size();

            // Parse Range header
            long rangeStart = 0;
            long rangeEnd = fileSize - 1;
            
            if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
                String[] ranges = rangeHeader.substring(6).split("-");
                rangeStart = Long.parseLong(ranges[0]);
                if (ranges.length > 1 && !ranges[1].isEmpty()) {
                    rangeEnd = Long.parseLong(ranges[1]);
                }
            }

            // Limit chunk size to 5MB for smooth streaming
            long chunkSize = Math.min(rangeEnd - rangeStart + 1, 5 * 1024 * 1024);
            rangeEnd = rangeStart + chunkSize - 1;

            long contentLength = rangeEnd - rangeStart + 1;
            final long start = rangeStart;
            final long end = rangeEnd;

            StreamingResponseBody responseBody = outputStream -> {
                try (InputStream inputStream = minioClient.getObject(
                        GetObjectArgs.builder()
                            .bucket(bucketName)
                            .object(minioPath)
                            .offset(start)
                            .length(end - start + 1)
                            .build())) {
                    
                    byte[] buffer = new byte[8192];
                    int bytesRead;
                    while ((bytesRead = inputStream.read(buffer)) != -1) {
                        outputStream.write(buffer, 0, bytesRead);
                        outputStream.flush();
                    }
                } catch (Exception e) {
                    logger.error("Streaming error: {}", e.getMessage());
                }
            };

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(contentType));
            headers.setContentLength(contentLength);
            headers.set("Accept-Ranges", "bytes");
            headers.set("Content-Range", String.format("bytes %d-%d/%d", start, end, fileSize));

            return ResponseEntity
                .status(rangeHeader != null ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK)
                .headers(headers)
                .body(responseBody);

        } catch (Exception e) {
            logger.error("Stream failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get thumbnail for instant grid rendering
     */
    @GetMapping("/thumbnail/{fileId}")
    public ResponseEntity<byte[]> getThumbnail(
            @PathVariable String fileId,
            @AuthenticationPrincipal UserDetails userDetails) {

        try {
            String username = userDetails.getUsername();
            byte[] thumbnail = thumbnailService.getThumbnail(username, fileId);

            if (thumbnail == null) {
                return ResponseEntity.notFound().build();
            }

            return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .header(HttpHeaders.CACHE_CONTROL, "max-age=86400") // 24h browser cache
                .body(thumbnail);

        } catch (Exception e) {
            logger.error("Thumbnail fetch failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private String getContentType(String filename) {
        String ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
        return switch (ext) {
            case "mp4" -> "video/mp4";
            case "webm" -> "video/webm";
            case "mov" -> "video/quicktime";
            case "mkv" -> "video/x-matroska";
            case "avi" -> "video/x-msvideo";
            default -> "application/octet-stream";
        };
    }
}
