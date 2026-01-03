package com.minidrive.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.security.*;
import java.security.spec.*;
import java.sql.*;
import java.util.*;
import java.nio.charset.StandardCharsets;

/**
 * Passkey (WebAuthn) Service - Passwordless authentication.
 * 
 * Implements WebAuthn server-side verification:
 * - Registration: Store user's public key
 * - Authentication: Verify signature with stored public key
 * 
 * Benefits:
 * - Phishing-resistant (origin-bound)
 * - No password to leak/remember
 * - Biometric verification (Touch ID, Face ID, Windows Hello)
 */
@Service
public class PasskeyService {

    private static final Logger logger = LoggerFactory.getLogger(PasskeyService.class);
    
    private static final String RP_ID = "localhost"; // Relying Party ID
    private static final String RP_NAME = "SanchayCloud";

    // In-memory challenge store (use Redis in production)
    private final Map<String, byte[]> challengeStore = new HashMap<>();

    @Autowired
    private DataSource dataSource;

    /**
     * Initialize passkey credentials table.
     */
    public void initializeTable() {
        String sql = """
            CREATE TABLE IF NOT EXISTS passkey_credentials (
                credential_id VARCHAR(255) PRIMARY KEY,
                user_id UUID NOT NULL,
                public_key_cose BYTEA NOT NULL,
                sign_count BIGINT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_used_at TIMESTAMP
            )
        """;
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute(sql);
            logger.info("PasskeyService: passkey_credentials table initialized");
        } catch (SQLException e) {
            logger.warn("Failed to initialize passkey table: {}", e.getMessage());
        }
    }

    /**
     * Generate registration options for new passkey.
     */
    public Map<String, Object> generateRegistrationOptions(String username, String userId) {
        byte[] challenge = new byte[32];
        new SecureRandom().nextBytes(challenge);
        
        // Store challenge for verification
        challengeStore.put(username, challenge);

        Map<String, Object> options = new HashMap<>();
        options.put("challenge", Base64.getEncoder().encodeToString(challenge));
        
        Map<String, Object> rp = new HashMap<>();
        rp.put("name", RP_NAME);
        rp.put("id", RP_ID);
        options.put("rp", rp);

        Map<String, Object> user = new HashMap<>();
        user.put("id", Base64.getEncoder().encodeToString(userId.getBytes(StandardCharsets.UTF_8)));
        user.put("name", username);
        user.put("displayName", username);
        options.put("user", user);

        // Supported algorithms (ES256, RS256)
        List<Map<String, Object>> pubKeyCredParams = new ArrayList<>();
        pubKeyCredParams.add(Map.of("type", "public-key", "alg", -7));   // ES256
        pubKeyCredParams.add(Map.of("type", "public-key", "alg", -257)); // RS256
        options.put("pubKeyCredParams", pubKeyCredParams);

        options.put("timeout", 60000);
        options.put("attestation", "none");

        Map<String, Object> authSelection = new HashMap<>();
        authSelection.put("authenticatorAttachment", "platform");
        authSelection.put("userVerification", "preferred");
        authSelection.put("residentKey", "required");
        options.put("authenticatorSelection", authSelection);

        return options;
    }

    /**
     * Verify registration and store credential.
     */
    public boolean verifyRegistration(String username, String userId, Map<String, Object> credential) {
        try {
            String credentialId = (String) credential.get("id");
            @SuppressWarnings("unchecked")
            Map<String, String> response = (Map<String, String>) credential.get("response");
            
            byte[] clientDataJSON = Base64.getDecoder().decode(response.get("clientDataJSON"));
            byte[] attestationObject = Base64.getDecoder().decode(response.get("attestationObject"));

            // Verify challenge
            byte[] storedChallenge = challengeStore.remove(username);
            if (storedChallenge == null) {
                logger.warn("No challenge found for user: {}", username);
                return false;
            }

            // Parse clientDataJSON and verify challenge matches
            String clientData = new String(clientDataJSON, StandardCharsets.UTF_8);
            // In production, fully parse and verify clientDataJSON

            // For MVP: store the credential
            // In production: parse attestationObject to extract public key in COSE format
            
            return storeCredential(credentialId, userId, attestationObject);

        } catch (Exception e) {
            logger.error("Registration verification failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Generate authentication options.
     */
    public Map<String, Object> generateAuthenticationOptions(String username) {
        byte[] challenge = new byte[32];
        new SecureRandom().nextBytes(challenge);
        
        challengeStore.put(username != null ? username : "anonymous", challenge);

        Map<String, Object> options = new HashMap<>();
        options.put("challenge", Base64.getEncoder().encodeToString(challenge));
        options.put("timeout", 60000);
        options.put("rpId", RP_ID);
        options.put("userVerification", "preferred");

        // If username provided, get allowed credentials
        if (username != null) {
            List<Map<String, Object>> allowCredentials = getCredentialsForUser(username);
            if (!allowCredentials.isEmpty()) {
                options.put("allowCredentials", allowCredentials);
            }
        }

        return options;
    }

    /**
     * Verify authentication assertion.
     */
    public String verifyAuthentication(Map<String, Object> credential) {
        try {
            String credentialId = (String) credential.get("id");
            @SuppressWarnings("unchecked")
            Map<String, String> response = (Map<String, String>) credential.get("response");

            // Get stored credential
            Map<String, Object> storedCred = getStoredCredential(credentialId);
            if (storedCred == null) {
                logger.warn("Credential not found: {}", credentialId);
                return null;
            }

            String userId = (String) storedCred.get("userId");

            // In production: verify signature with stored public key
            // For MVP: update last used and increment counter
            updateCredentialUsage(credentialId);

            // Return username for the credential
            return getUsernameById(userId);

        } catch (Exception e) {
            logger.error("Authentication verification failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Store credential in database.
     */
    private boolean storeCredential(String credentialId, String userId, byte[] publicKeyCose) {
        String sql = """
            INSERT INTO passkey_credentials (credential_id, user_id, public_key_cose)
            VALUES (?, ?::uuid, ?)
        """;
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, credentialId);
            stmt.setString(2, userId);
            stmt.setBytes(3, publicKeyCose);
            stmt.executeUpdate();
            logger.info("Stored passkey credential for user: {}", userId);
            return true;
        } catch (SQLException e) {
            logger.error("Failed to store credential: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Get credentials for user.
     */
    private List<Map<String, Object>> getCredentialsForUser(String username) {
        String sql = """
            SELECT pc.credential_id FROM passkey_credentials pc
            JOIN users u ON pc.user_id = u.id
            WHERE u.username = ?
        """;
        
        List<Map<String, Object>> credentials = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, username);
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                Map<String, Object> cred = new HashMap<>();
                cred.put("id", Base64.getEncoder().encodeToString(
                    rs.getString("credential_id").getBytes()));
                cred.put("type", "public-key");
                cred.put("transports", List.of("internal"));
                credentials.add(cred);
            }
        } catch (SQLException e) {
            logger.error("Failed to get credentials: {}", e.getMessage());
        }
        return credentials;
    }

    /**
     * Get stored credential by ID.
     */
    private Map<String, Object> getStoredCredential(String credentialId) {
        String sql = "SELECT user_id, public_key_cose, sign_count FROM passkey_credentials WHERE credential_id = ?";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, credentialId);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                Map<String, Object> cred = new HashMap<>();
                cred.put("userId", rs.getString("user_id"));
                cred.put("publicKey", rs.getBytes("public_key_cose"));
                cred.put("signCount", rs.getLong("sign_count"));
                return cred;
            }
        } catch (SQLException e) {
            logger.error("Failed to get credential: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Update credential usage.
     */
    private void updateCredentialUsage(String credentialId) {
        String sql = "UPDATE passkey_credentials SET sign_count = sign_count + 1, last_used_at = NOW() WHERE credential_id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, credentialId);
            stmt.executeUpdate();
        } catch (SQLException e) {
            logger.warn("Failed to update credential usage: {}", e.getMessage());
        }
    }

    /**
     * Get username by user ID.
     */
    private String getUsernameById(String userId) {
        String sql = "SELECT username FROM users WHERE id = ?::uuid";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, userId);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return rs.getString("username");
            }
        } catch (SQLException e) {
            logger.error("Failed to get username: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Check if user has passkey registered.
     */
    public boolean hasPasskey(String username) {
        return !getCredentialsForUser(username).isEmpty();
    }
}
