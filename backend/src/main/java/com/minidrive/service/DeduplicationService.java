package com.minidrive.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.minidrive.storage.StorageService;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.security.MessageDigest;
import java.sql.*;
import java.util.*;
import javax.sql.DataSource;

/**
 * Global Deduplication Service - Zero-Knowledge content-addressable storage.
 * 
 * When multiple users upload the same file:
 * 1. Client computes content hash before upload
 * 2. Server checks if hash already exists globally
 * 3. If exists → link to existing blob (no upload needed!)
 * 4. If not → upload and register globally
 * 
 * Security: Uses convergent encryption (key = hash of content)
 * so identical files produce identical ciphertext, enabling dedup
 * without server seeing plaintext.
 */
@Service
public class DeduplicationService {

    private static final Logger logger = LoggerFactory.getLogger(DeduplicationService.class);

    @Autowired
    private DataSource dataSource;

    @Autowired
    private StorageService storageService;

    @Autowired
    private EncryptionService encryptionService;

    /**
     * Initialize global dedup table if it doesn't exist.
     */
    public void initializeTable() {
        String sql = """
            CREATE TABLE IF NOT EXISTS global_content_hashes (
                content_hash VARCHAR(64) PRIMARY KEY,
                encrypted_blob_hash VARCHAR(64) NOT NULL,
                size BIGINT NOT NULL,
                ref_count INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """;
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute(sql);
            logger.info("DeduplicationService: global_content_hashes table initialized");
        } catch (SQLException e) {
            logger.warn("Failed to initialize dedup table: {}", e.getMessage());
        }
    }

    /**
     * Check if content already exists globally.
     * 
     * @param contentHash SHA-256 hash of original content (computed client-side)
     * @return Map with exists flag and blob hash if found
     */
    public Map<String, Object> checkDuplicate(String contentHash) {
        String sql = "SELECT encrypted_blob_hash, size, ref_count FROM global_content_hashes WHERE content_hash = ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, contentHash);
            ResultSet rs = stmt.executeQuery();
            
            if (rs.next()) {
                Map<String, Object> result = new HashMap<>();
                result.put("exists", true);
                result.put("blobHash", rs.getString("encrypted_blob_hash"));
                result.put("size", rs.getLong("size"));
                result.put("refCount", rs.getInt("ref_count"));
                
                // Increment reference count
                incrementRefCount(contentHash);
                
                logger.info("Dedup hit! Content {} already exists with {} refs", 
                    contentHash.substring(0, 8), rs.getInt("ref_count") + 1);
                
                return result;
            }
        } catch (SQLException e) {
            logger.error("Dedup check failed: {}", e.getMessage());
        }
        
        return Map.of("exists", false);
    }

    /**
     * Register new content in global dedup table.
     */
    public void registerContent(String contentHash, String encryptedBlobHash, long size) {
        String sql = """
            INSERT INTO global_content_hashes (content_hash, encrypted_blob_hash, size)
            VALUES (?, ?, ?)
            ON CONFLICT (content_hash) DO UPDATE SET ref_count = global_content_hashes.ref_count + 1
        """;
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, contentHash);
            stmt.setString(2, encryptedBlobHash);
            stmt.setLong(3, size);
            stmt.executeUpdate();
            logger.info("Registered content {} in global dedup table", contentHash.substring(0, 8));
        } catch (SQLException e) {
            logger.error("Failed to register content: {}", e.getMessage());
        }
    }

    /**
     * Increment reference count when content is shared.
     */
    private void incrementRefCount(String contentHash) {
        String sql = "UPDATE global_content_hashes SET ref_count = ref_count + 1 WHERE content_hash = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, contentHash);
            stmt.executeUpdate();
        } catch (SQLException e) {
            logger.warn("Failed to increment ref count: {}", e.getMessage());
        }
    }

    /**
     * Decrement reference count on file delete.
     * If ref_count reaches 0, the blob can be garbage collected.
     */
    public void decrementRefCount(String contentHash) {
        String sql = "UPDATE global_content_hashes SET ref_count = ref_count - 1 WHERE content_hash = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, contentHash);
            stmt.executeUpdate();
        } catch (SQLException e) {
            logger.warn("Failed to decrement ref count: {}", e.getMessage());
        }
    }

    /**
     * Derive convergent encryption key from content hash.
     * Same content → same key → same ciphertext → dedup works!
     * 
     * @param contentHash SHA-256 of plaintext
     * @return AES-256 key for convergent encryption
     */
    public SecretKey deriveConvergentKey(String contentHash) {
        try {
            // Use HKDF-like derivation: SHA-256(contentHash + "convergent-key")
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(hexToBytes(contentHash));
            md.update("convergent-key-v1".getBytes());
            byte[] keyBytes = md.digest();
            
            return new SecretKeySpec(keyBytes, "AES");
        } catch (Exception e) {
            logger.error("Failed to derive convergent key: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Get deduplication statistics.
     */
    public Map<String, Object> getStats() {
        String sql = "SELECT COUNT(*) as unique_content, SUM(ref_count) as total_refs, SUM(size) as unique_size FROM global_content_hashes";
        
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            if (rs.next()) {
                long uniqueContent = rs.getLong("unique_content");
                long totalRefs = rs.getLong("total_refs");
                long uniqueSize = rs.getLong("unique_size");
                
                // Estimate savings: (total_refs - unique) * avg_size
                long estimatedSavings = totalRefs > uniqueContent 
                    ? (totalRefs - uniqueContent) * (uniqueSize / Math.max(1, uniqueContent))
                    : 0;
                
                return Map.of(
                    "uniqueContent", uniqueContent,
                    "totalReferences", totalRefs,
                    "uniqueStorageBytes", uniqueSize,
                    "estimatedSavingsBytes", estimatedSavings,
                    "deduplicationRatio", totalRefs > 0 ? (double) uniqueContent / totalRefs : 1.0
                );
            }
        } catch (SQLException e) {
            logger.error("Failed to get dedup stats: {}", e.getMessage());
        }
        
        return Map.of();
    }

    private byte[] hexToBytes(String hex) {
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }
}
