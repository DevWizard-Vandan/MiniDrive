package com.minidrive.memory;

import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.List;
import java.util.UUID;

/**
 * Async worker that processes files for Sanchay Memory.
 * Extracts text -> chunks -> embeddings -> stores vectors.
 */
@Service
public class MemoryWorker {

    private static final Logger logger = LoggerFactory.getLogger(MemoryWorker.class);

    @Autowired
    private MinioClient minioClient;

    @Autowired
    private TextExtractionService textExtractionService;

    @Autowired
    private EmbeddingService embeddingService;

    @Autowired
    private VectorRepository vectorRepository;

    @Value("${minio.bucket:user-uploads}")
    private String bucketName;

    /**
     * Process file asynchronously after upload.
     * Called from UploadController after successful upload.
     */
    @Async
    public void processFileAsync(UUID fileId, int userId, String filename, String minioPath) {
        if (!textExtractionService.supportsExtraction(filename)) {
            logger.info("File type not supported for memory: {}", filename);
            return;
        }

        logger.info("Starting memory processing for: {} ({})", filename, fileId);
        vectorRepository.updateProcessingStatus(fileId, "processing", 0, null);

        try {
            // 1. Fetch file from MinIO
            InputStream inputStream = minioClient.getObject(
                GetObjectArgs.builder()
                    .bucket(bucketName)
                    .object(minioPath)
                    .build()
            );

            // 2. Extract text
            String text = textExtractionService.extractText(inputStream, filename);
            if (text == null || text.isBlank()) {
                vectorRepository.updateProcessingStatus(fileId, "failed", 0, "No text extracted");
                return;
            }

            // 3. Chunk text
            List<TextExtractionService.TextChunk> chunks = 
                textExtractionService.chunkText(text, fileId.toString());

            if (chunks.isEmpty()) {
                vectorRepository.updateProcessingStatus(fileId, "failed", 0, "No chunks created");
                return;
            }

            // 4. Generate embeddings and store
            for (TextExtractionService.TextChunk chunk : chunks) {
                float[] embedding = embeddingService.embed(chunk.content());
                vectorRepository.saveChunkEmbedding(
                    fileId, 
                    userId, 
                    chunk.chunkIndex(), 
                    chunk.content(), 
                    embedding
                );
            }

            vectorRepository.updateProcessingStatus(fileId, "completed", chunks.size(), null);
            logger.info("Memory processing complete for {}: {} chunks", filename, chunks.size());

        } catch (Exception e) {
            logger.error("Memory processing failed for {}: {}", filename, e.getMessage());
            vectorRepository.updateProcessingStatus(fileId, "failed", 0, e.getMessage());
        }
    }

    /**
     * Reprocess a file (e.g., after model update)
     */
    public void reprocessFile(UUID fileId, int userId, String filename, String minioPath) {
        // Delete existing embeddings
        vectorRepository.deleteFileEmbeddings(fileId);
        
        // Reprocess
        processFileAsync(fileId, userId, filename, minioPath);
    }
}
