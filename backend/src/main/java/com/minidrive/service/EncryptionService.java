package com.minidrive.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM Encryption Service for Zero-Knowledge chunk encryption.
 * 
 * Architecture:
 * - Each user has a unique Data Encryption Key (DEK)
 * - DEKs are encrypted with a Master Key (KEK) before storage
 * - Chunks are encrypted with the user's DEK before upload to MinIO
 * - MinIO/S3 never sees plaintext data
 * 
 * Security Properties:
 * - AES-256-GCM provides authenticated encryption (confidentiality + integrity)
 * - 12-byte random IV per encryption (prepended to ciphertext)
 * - 128-bit authentication tag
 */
@Service
public class EncryptionService {

    private static final Logger logger = LoggerFactory.getLogger(EncryptionService.class);

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;      // 96 bits (NIST recommended)
    private static final int GCM_TAG_LENGTH = 128;    // 128 bits authentication tag
    private static final int AES_KEY_SIZE = 256;      // AES-256

    // Master Key for encrypting user DEKs (in production: use Vault/KMS)
    @Value("${minidrive.encryption.master-key:default-master-key-change-in-prod!}")
    private String masterKeyBase64;

    private SecretKey masterKey;

    // ==================== KEY GENERATION ====================

    /**
     * Generate a new AES-256 Data Encryption Key for a user.
     * Called during user registration.
     * 
     * @return Base64-encoded encrypted DEK (ready for DB storage)
     */
    public String generateUserKey() {
        try {
            KeyGenerator keyGen = KeyGenerator.getInstance("AES");
            keyGen.init(AES_KEY_SIZE, new SecureRandom());
            SecretKey userDEK = keyGen.generateKey();

            // Encrypt the DEK with master key before storage
            byte[] encryptedDEK = encryptWithMasterKey(userDEK.getEncoded());
            return Base64.getEncoder().encodeToString(encryptedDEK);
        } catch (Exception e) {
            logger.error("Failed to generate user key: {}", e.getMessage());
            throw new RuntimeException("Key generation failed", e);
        }
    }

    /**
     * Decrypt a stored user key to get the actual DEK.
     * 
     * @param encryptedKeyBase64 Base64-encoded encrypted DEK from DB
     * @return The user's SecretKey for data encryption
     */
    public SecretKey decryptUserKey(String encryptedKeyBase64) {
        try {
            byte[] encryptedDEK = Base64.getDecoder().decode(encryptedKeyBase64);
            byte[] dekBytes = decryptWithMasterKey(encryptedDEK);
            return new SecretKeySpec(dekBytes, "AES");
        } catch (Exception e) {
            logger.error("Failed to decrypt user key: {}", e.getMessage());
            throw new RuntimeException("Key decryption failed", e);
        }
    }

    // ==================== CHUNK ENCRYPTION ====================

    /**
     * Encrypt a chunk before uploading to MinIO.
     * 
     * @param plaintext Raw chunk data
     * @param userKey   User's DEK
     * @return Encrypted chunk (IV prepended to ciphertext)
     */
    public byte[] encryptChunk(byte[] plaintext, SecretKey userKey) {
        try {
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            
            // Generate random IV for this encryption
            byte[] iv = new byte[GCM_IV_LENGTH];
            new SecureRandom().nextBytes(iv);
            
            GCMParameterSpec paramSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.ENCRYPT_MODE, userKey, paramSpec);
            
            byte[] ciphertext = cipher.doFinal(plaintext);
            
            // Prepend IV to ciphertext: [IV (12 bytes)][Ciphertext + Tag]
            return ByteBuffer.allocate(iv.length + ciphertext.length)
                    .put(iv)
                    .put(ciphertext)
                    .array();
        } catch (Exception e) {
            logger.error("Chunk encryption failed: {}", e.getMessage());
            throw new RuntimeException("Encryption failed", e);
        }
    }

    /**
     * Decrypt a chunk after downloading from MinIO.
     * 
     * @param ciphertext Encrypted chunk (IV + ciphertext)
     * @param userKey    User's DEK
     * @return Decrypted plaintext chunk
     */
    public byte[] decryptChunk(byte[] ciphertext, SecretKey userKey) {
        try {
            if (ciphertext.length < GCM_IV_LENGTH) {
                throw new IllegalArgumentException("Ciphertext too short");
            }

            ByteBuffer buffer = ByteBuffer.wrap(ciphertext);
            
            // Extract IV
            byte[] iv = new byte[GCM_IV_LENGTH];
            buffer.get(iv);
            
            // Extract ciphertext
            byte[] encryptedData = new byte[buffer.remaining()];
            buffer.get(encryptedData);
            
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec paramSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.DECRYPT_MODE, userKey, paramSpec);
            
            return cipher.doFinal(encryptedData);
        } catch (Exception e) {
            logger.error("Chunk decryption failed: {}", e.getMessage());
            throw new RuntimeException("Decryption failed", e);
        }
    }

    // ==================== MASTER KEY OPERATIONS ====================

    private SecretKey getMasterKey() {
        if (masterKey == null) {
            // Derive a proper 256-bit key from the configured value
            byte[] keyBytes = new byte[32];
            byte[] configBytes = masterKeyBase64.getBytes();
            System.arraycopy(configBytes, 0, keyBytes, 0, Math.min(configBytes.length, 32));
            masterKey = new SecretKeySpec(keyBytes, "AES");
        }
        return masterKey;
    }

    private byte[] encryptWithMasterKey(byte[] data) throws Exception {
        Cipher cipher = Cipher.getInstance(ALGORITHM);
        byte[] iv = new byte[GCM_IV_LENGTH];
        new SecureRandom().nextBytes(iv);
        
        cipher.init(Cipher.ENCRYPT_MODE, getMasterKey(), new GCMParameterSpec(GCM_TAG_LENGTH, iv));
        byte[] ciphertext = cipher.doFinal(data);
        
        return ByteBuffer.allocate(iv.length + ciphertext.length)
                .put(iv)
                .put(ciphertext)
                .array();
    }

    private byte[] decryptWithMasterKey(byte[] data) throws Exception {
        ByteBuffer buffer = ByteBuffer.wrap(data);
        
        byte[] iv = new byte[GCM_IV_LENGTH];
        buffer.get(iv);
        
        byte[] ciphertext = new byte[buffer.remaining()];
        buffer.get(ciphertext);
        
        Cipher cipher = Cipher.getInstance(ALGORITHM);
        cipher.init(Cipher.DECRYPT_MODE, getMasterKey(), new GCMParameterSpec(GCM_TAG_LENGTH, iv));
        
        return cipher.doFinal(ciphertext);
    }
}
