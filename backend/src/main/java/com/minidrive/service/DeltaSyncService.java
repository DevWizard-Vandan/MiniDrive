package com.minidrive.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.minidrive.repository.FileRepository;
import com.minidrive.storage.StorageService;

import javax.crypto.SecretKey;
import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.util.*;

/**
 * Delta Sync Service - Rsync-style binary diff for efficient file updates.
 * 
 * Computes block signatures and applies delta patches to reconstruct files
 * from a combination of existing blocks and new uploaded blocks.
 * 
 * Result: 99%+ bandwidth savings for small edits to large files.
 */
@Service
public class DeltaSyncService {

    private static final Logger logger = LoggerFactory.getLogger(DeltaSyncService.class);
    
    private static final int BLOCK_SIZE = 4096; // 4KB blocks (must match frontend)

    @Autowired
    private FileRepository fileRepository;

    @Autowired
    private StorageService storageService;

    @Autowired
    private EncryptionService encryptionService;

    /**
     * Compute signature for an existing file.
     * Returns block hashes that the client can use to compute delta.
     * 
     * @param fileId File to compute signature for
     * @param username Owner of the file
     * @param userKey User's encryption key (for decryption)
     * @return Signature object with block hashes
     */
    public Map<String, Object> computeSignature(String fileId, String username, SecretKey userKey) {
        List<String> chunkHashes = fileRepository.getFileChunks(fileId);
        if (chunkHashes == null || chunkHashes.isEmpty()) {
            return null;
        }

        List<Map<String, Object>> signatures = new ArrayList<>();
        int blockIndex = 0;
        int globalOffset = 0;

        for (String chunkHash : chunkHashes) {
            // Download chunk
            byte[] chunkData;
            try {
                if (userKey != null) {
                    chunkData = storageService.downloadChunkEncrypted(chunkHash, userKey);
                } else {
                    chunkData = storageService.downloadChunk(chunkHash);
                }
            } catch (Exception e) {
                chunkData = storageService.downloadChunk(chunkHash);
            }

            if (chunkData.length == 0) continue;

            // Split chunk into blocks and compute signatures
            for (int offset = 0; offset < chunkData.length; offset += BLOCK_SIZE) {
                int end = Math.min(offset + BLOCK_SIZE, chunkData.length);
                byte[] block = Arrays.copyOfRange(chunkData, offset, end);

                Map<String, Object> blockSig = new HashMap<>();
                blockSig.put("index", blockIndex);
                blockSig.put("weakHash", computeWeakHash(block));
                blockSig.put("hash", computeStrongHash(block));
                blockSig.put("offset", globalOffset);
                blockSig.put("length", block.length);

                signatures.add(blockSig);
                blockIndex++;
                globalOffset += block.length;
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("blockSize", BLOCK_SIZE);
        result.put("signatures", signatures);
        result.put("totalBlocks", signatures.size());

        logger.info("Computed signature for file {}: {} blocks", fileId, signatures.size());
        return result;
    }

    /**
     * Apply delta patch to reconstruct new file version.
     * 
     * @param fileId Original file ID
     * @param instructions Delta instructions from client
     * @param newBlocks New block data from client
     * @param username Owner
     * @param userKey User's encryption key
     * @return Reconstructed file bytes
     */
    public byte[] applyDelta(
            String fileId, 
            List<Map<String, Object>> instructions,
            Map<Integer, byte[]> newBlocks,
            String username,
            SecretKey userKey) {
        
        logger.info("Applying delta with {} instructions, {} new blocks", 
            instructions.size(), newBlocks.size());

        // Load original file blocks
        List<String> chunkHashes = fileRepository.getFileChunks(fileId);
        List<byte[]> originalBlocks = new ArrayList<>();

        for (String chunkHash : chunkHashes) {
            byte[] chunkData;
            try {
                if (userKey != null) {
                    chunkData = storageService.downloadChunkEncrypted(chunkHash, userKey);
                } else {
                    chunkData = storageService.downloadChunk(chunkHash);
                }
            } catch (Exception e) {
                chunkData = storageService.downloadChunk(chunkHash);
            }

            // Split into blocks
            for (int offset = 0; offset < chunkData.length; offset += BLOCK_SIZE) {
                int end = Math.min(offset + BLOCK_SIZE, chunkData.length);
                originalBlocks.add(Arrays.copyOfRange(chunkData, offset, end));
            }
        }

        // Sort instructions by destination index
        instructions.sort((a, b) -> {
            int destA = ((Number) a.get("destIndex")).intValue();
            int destB = ((Number) b.get("destIndex")).intValue();
            return Integer.compare(destA, destB);
        });

        // Reconstruct file
        ByteArrayOutputStream result = new ByteArrayOutputStream();
        
        for (Map<String, Object> instruction : instructions) {
            String type = (String) instruction.get("type");
            int destIndex = ((Number) instruction.get("destIndex")).intValue();

            try {
                if ("COPY".equals(type)) {
                    // Copy from original file
                    int sourceIndex = ((Number) instruction.get("sourceIndex")).intValue();
                    if (sourceIndex < originalBlocks.size()) {
                        result.write(originalBlocks.get(sourceIndex));
                    }
                } else if ("INSERT".equals(type)) {
                    // Insert new block
                    int blockIndex = ((Number) instruction.get("blockIndex")).intValue();
                    byte[] blockData = newBlocks.get(blockIndex);
                    if (blockData != null) {
                        result.write(blockData);
                    }
                }
            } catch (Exception e) {
                logger.error("Error applying instruction at index {}: {}", destIndex, e.getMessage());
            }
        }

        logger.info("Delta applied: reconstructed {} bytes", result.size());
        return result.toByteArray();
    }

    /**
     * Compute weak rolling hash (Adler-32 variant).
     */
    private int computeWeakHash(byte[] block) {
        int a = 1;
        int b = 0;

        for (byte value : block) {
            a = (a + (value & 0xFF)) % 65521;
            b = (b + a) % 65521;
        }

        return (b << 16) | a;
    }

    /**
     * Compute strong hash (SHA-256).
     */
    private String computeStrongHash(byte[] block) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(block);
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }
}
