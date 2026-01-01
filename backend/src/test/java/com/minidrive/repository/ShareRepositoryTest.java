package com.minidrive.repository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class ShareRepositoryTest {

    @Autowired
    private ShareRepository shareRepository;

    @Autowired
    private FileRepository fileRepository;

    @Autowired
    private DataSource dataSource;

    private static final String TEST_USER = "shareuser";
    private static final String TEST_USER_ID = UUID.randomUUID().toString();
    private String testFileId;

    @BeforeEach
    void setUp() throws Exception {
        testFileId = UUID.randomUUID().toString();
        
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            
            stmt.execute("DROP TABLE IF EXISTS file_chunks");
            stmt.execute("DROP TABLE IF EXISTS global_chunks");
            stmt.execute("DROP TABLE IF EXISTS files");
            stmt.execute("DROP TABLE IF EXISTS folders");
            stmt.execute("DROP TABLE IF EXISTS users");

            stmt.execute("""
                CREATE TABLE users (
                    id UUID PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password VARCHAR(255)
                )
            """);

            stmt.execute("""
                CREATE TABLE files (
                    file_id UUID PRIMARY KEY,
                    filename VARCHAR(255),
                    size BIGINT,
                    owner_id UUID REFERENCES users(id),
                    folder_id UUID,
                    is_trashed BOOLEAN DEFAULT FALSE,
                    is_starred BOOLEAN DEFAULT FALSE,
                    share_token VARCHAR(64) UNIQUE,
                    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """);

            stmt.execute("INSERT INTO users (id, username, password) VALUES ('" + TEST_USER_ID + "', '" + TEST_USER + "', 'pass')");
        }
        
        // Create a test file
        fileRepository.saveFileMetadata(testFileId, "shared-doc.pdf", 5000, TEST_USER, null);
    }

    @Test
    void testCreateShareLink_Success() {
        String token = shareRepository.createShareLink(testFileId, TEST_USER);
        
        assertNotNull(token);
        assertEquals(16, token.length());
    }

    @Test
    void testCreateShareLink_InvalidFile() {
        String token = shareRepository.createShareLink(UUID.randomUUID().toString(), TEST_USER);
        
        assertNull(token);
    }

    @Test
    void testGetFileByShareToken() {
        String token = shareRepository.createShareLink(testFileId, TEST_USER);
        
        Map<String, Object> file = shareRepository.getFileByShareToken(token);
        
        assertNotNull(file);
        assertEquals(testFileId, file.get("id"));
        assertEquals("shared-doc.pdf", file.get("name"));
        assertEquals(5000L, file.get("size"));
    }

    @Test
    void testGetFileByShareToken_Invalid() {
        Map<String, Object> file = shareRepository.getFileByShareToken("invalidtoken123");
        
        assertNull(file);
    }

    @Test
    void testRevokeShareLink() {
        // First create a share link
        String token = shareRepository.createShareLink(testFileId, TEST_USER);
        assertNotNull(token);
        
        // Revoke it
        String result = shareRepository.revokeShareLink(testFileId, TEST_USER);
        assertTrue(result.contains("revoked"));
        
        // Verify it's gone
        Map<String, Object> file = shareRepository.getFileByShareToken(token);
        assertNull(file);
    }
}
