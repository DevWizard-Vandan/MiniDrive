package com.minidrive.memory;

import com.minidrive.auth.AuthService;
import com.minidrive.repository.FileRepository;
import com.minidrive.service.EncryptionService;
import com.minidrive.storage.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.List;
import java.util.UUID;

/**
 * Async worker that processes files for Sanchay Memory.
 * Extracts text -> chunks -> embeddings -> stores vectors.
 * 
 * Works with chunked storage: reconstructs files from individual chunks.
 * Handles encrypted files (Zero-Knowledge decryption).
 */
@Service
public class MemoryWorker {

    private static final Logger logger = LoggerFactory.getLogger(MemoryWorker.class);

    @Autowired
    private StorageService storageService;

    @Autowired
    private FileRepository fileRepository;

    @Autowired
    private TextExtractionService textExtractionService;

    @Autowired
    private EmbeddingService embeddingService;

    @Autowired
    private VectorRepository vectorRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private EncryptionService encryptionService;

    /**
     * Process file asynchronously after upload.
     * Called from DriveController after successful upload.
     */
    @Async
    public void processFileAsync(UUID fileId, String userId, String filename, String username) {
        if (!textExtractionService.supportsExtraction(filename)) {
            logger.info("File type not supported for memory: {}", filename);
            return;
        }

        logger.info("🧠 Memory: Starting processing for {} ({})", filename, fileId);
        
        try {
            vectorRepository.updateProcessingStatus(fileId, "processing", 0, null);
        } catch (Exception e) {
            logger.warn("Could not update processing status (table may not exist): {}", e.getMessage());
        }

        try {
            // 1. Get user's encryption key for decryption
            SecretKey userKey = getUserEncryptionKey(username);
            logger.info("🧠 Memory: User {} encryption key: {}", username, userKey != null ? "FOUND" : "NOT FOUND");
            
            // 2. Reconstruct file from chunks (with decryption)
            List<String> chunkHashes = fileRepository.getFileChunks(fileId.toString());
            
            if (chunkHashes == null || chunkHashes.isEmpty()) {
                logger.warn("No chunks found for file: {}", fileId);
                updateStatusSafe(fileId, "failed", 0, "No chunks found");
                return;
            }

            // Download and concatenate all chunks (decrypt if needed)
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            boolean decryptionFailed = false;
            
            for (String hash : chunkHashes) {
                byte[] chunkData;
                if (userKey != null) {
                    // Try encrypted first
                    try {
                        chunkData = storageService.downloadChunkEncrypted(hash, userKey);
                    } catch (Exception e) {
                        // Decryption failed - this means either wrong key or unencrypted data
                        // Try raw download to check if it's actually unencrypted
                        chunkData = storageService.downloadChunk(hash);
                        
                        // Check if raw data looks like valid text/PDF (not encrypted)
                        if (chunkData.length > 4) {
                            // PDF magic bytes: %PDF
                            boolean isPdf = chunkData[0] == '%' && chunkData[1] == 'P' && chunkData[2] == 'D' && chunkData[3] == 'F';
                            // Text check: high ASCII readability ratio
                            int readable = 0;
                            for (int i = 0; i < Math.min(100, chunkData.length); i++) {
                                int b = chunkData[i] & 0xFF;
                                if ((b >= 32 && b < 127) || b == '\n' || b == '\r' || b == '\t') readable++;
                            }
                            boolean isText = readable > 80; // 80% readable
                            
                            if (!isPdf && !isText) {
                                logger.warn("🧠 Memory: Decryption failed and data appears encrypted. Skipping file.");
                                decryptionFailed = true;
                                break;
                            }
                            // Data is readable, continue with unencrypted data
                        } else {
                            decryptionFailed = true;
                            break;
                        }
                    }
                } else {
                    chunkData = storageService.downloadChunk(hash);
                }
                baos.write(chunkData);
            }
            
            if (decryptionFailed) {
                updateStatusSafe(fileId, "failed", 0, "Decryption failed - key mismatch or corrupted data");
                return;
            }
            
            byte[] fileData = baos.toByteArray();
            logger.info("🧠 Memory: Reconstructed {} bytes from {} chunks", fileData.length, chunkHashes.size());
            
            // Debug: log first 100 chars of data for text files
            if (filename.toLowerCase().endsWith(".txt")) {
                String preview = new String(fileData, 0, Math.min(100, fileData.length), java.nio.charset.StandardCharsets.UTF_8);
                logger.info("🧠 Memory: TXT preview: {}", preview.replaceAll("[\\r\\n]", " "));
            }

            // 3. Extract text (use byte-based extraction for better handling)
            String text = textExtractionService.extractTextFromBytes(fileData, filename);
            
            if (text == null || text.isBlank()) {
                logger.warn("No text extracted from: {}", filename);
                updateStatusSafe(fileId, "failed", 0, "No text extracted");
                return;
            }
            
            logger.info("🧠 Memory: Extracted {} characters from {}", text.length(), filename);

            // 4. Chunk text
            List<TextExtractionService.TextChunk> chunks = 
                textExtractionService.chunkText(text, fileId.toString());

            if (chunks.isEmpty()) {
                updateStatusSafe(fileId, "failed", 0, "No chunks created");
                return;
            }

            // 5. Generate embeddings and store
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

            updateStatusSafe(fileId, "completed", chunks.size(), null);
            logger.info("🧠 Memory: Processing complete for {}: {} chunks embedded", filename, chunks.size());

        } catch (Exception e) {
            logger.error("🧠 Memory: Processing failed for {}: {}", filename, e.getMessage(), e);
            updateStatusSafe(fileId, "failed", 0, e.getMessage());
        }
    }

    /**
     * Reprocess a file (e.g., after model update)
     */
    public void reprocessFile(UUID fileId, String userId, String filename, String username) {
        // Delete existing embeddings
        vectorRepository.deleteFileEmbeddings(fileId);
        
        // Reprocess
        processFileAsync(fileId, userId, filename, username);
    }

    private void updateStatusSafe(UUID fileId, String status, int chunks, String error) {
        try {
            vectorRepository.updateProcessingStatus(fileId, status, chunks, error);
        } catch (Exception e) {
            logger.warn("Could not update processing status: {}", e.getMessage());
        }
    }

    /**
     * Get user's decrypted encryption key for Zero-Knowledge operations.
     */
    private SecretKey getUserEncryptionKey(String username) {
        try {
            String encryptedKey = authService.getUserEncryptionKey(username);
            if (encryptedKey != null && !encryptedKey.isEmpty()) {
                return encryptionService.decryptUserKey(encryptedKey);
            }
        } catch (Exception e) {
            logger.debug("No encryption key for user {}: {}", username, e.getMessage());
        }
        return null;
    }
}
