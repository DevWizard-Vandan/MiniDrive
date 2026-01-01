package com.minidrive.repository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class FileRepositoryTest {

    @Autowired
    private FileRepository fileRepository;

    @Autowired
    private DataSource dataSource;

    private static final String TEST_USER = "testuser";
    private static final String TEST_USER_ID = UUID.randomUUID().toString();

    @BeforeEach
    void setUp() throws Exception {
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            
            // Drop tables if exist
            stmt.execute("DROP TABLE IF EXISTS file_chunks");
            stmt.execute("DROP TABLE IF EXISTS global_chunks");
            stmt.execute("DROP TABLE IF EXISTS files");
            stmt.execute("DROP TABLE IF EXISTS folders");
            stmt.execute("DROP TABLE IF EXISTS activities");
            stmt.execute("DROP TABLE IF EXISTS users");

            // Create users table
            stmt.execute("""
                CREATE TABLE users (
                    id UUID PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """);

            // Create files table
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

            // Create file_chunks table
            stmt.execute("""
                CREATE TABLE file_chunks (
                    file_id UUID,
                    chunk_hash VARCHAR(64),
                    chunk_index INT,
                    PRIMARY KEY (file_id, chunk_index)
                )
            """);

            // Create global_chunks table
            stmt.execute("""
                CREATE TABLE global_chunks (
                    chunk_hash VARCHAR(64) PRIMARY KEY,
                    ref_count INT DEFAULT 1
                )
            """);

            // Insert test user
            stmt.execute("INSERT INTO users (id, username, password) VALUES ('" + TEST_USER_ID + "', '" + TEST_USER + "', 'password')");
        }
    }

    @Test
    void testSaveFileMetadata_Success() {
        String fileId = UUID.randomUUID().toString();
        String fileName = "test-document.pdf";
        long size = 1024L;

        BaseRepository.DbResult result = fileRepository.saveFileMetadata(fileId, fileName, size, TEST_USER, null);

        assertTrue(result.success, "File metadata should be saved successfully");
        assertEquals(1, result.affectedRows);
    }

    @Test
    void testSaveFileMetadata_InvalidUser() {
        String fileId = UUID.randomUUID().toString();
        
        BaseRepository.DbResult result = fileRepository.saveFileMetadata(fileId, "file.txt", 100, "nonexistent", null);
        
        assertFalse(result.success, "Should fail for nonexistent user");
    }

    @Test
    void testGetFileMetadata() {
        // First save a file
        String fileId = UUID.randomUUID().toString();
        String fileName = "important.docx";
        long size = 2048L;
        fileRepository.saveFileMetadata(fileId, fileName, size, TEST_USER, null);

        // Then retrieve it
        Map<String, Object> metadata = fileRepository.getFileMetadata(fileName, TEST_USER);

        assertNotNull(metadata, "Metadata should not be null");
        assertEquals(fileId, metadata.get("id"));
        assertEquals(size, metadata.get("size"));
        assertFalse((Boolean) metadata.get("trashed"));
    }

    @Test
    void testAddAndGetChunks() {
        String fileId = UUID.randomUUID().toString();
        fileRepository.saveFileMetadata(fileId, "chunked.bin", 3000, TEST_USER, null);

        // Add chunks
        fileRepository.addChunkToFile(fileId, "hash1", 0);
        fileRepository.addChunkToFile(fileId, "hash2", 1);
        fileRepository.addChunkToFile(fileId, "hash3", 2);

        // Retrieve chunks
        List<String> chunks = fileRepository.getFileChunks(fileId);

        assertEquals(3, chunks.size());
        assertEquals("hash1", chunks.get(0));
        assertEquals("hash2", chunks.get(1));
        assertEquals("hash3", chunks.get(2));
    }

    @Test
    void testHasChunk() {
        assertFalse(fileRepository.hasChunk("nonexistent_hash"));

        fileRepository.registerGlobalChunk("existing_hash");
        assertTrue(fileRepository.hasChunk("existing_hash"));
    }

    @Test
    void testSearchFiles() {
        // Create some files
        fileRepository.saveFileMetadata(UUID.randomUUID().toString(), "report-2024.pdf", 1000, TEST_USER, null);
        fileRepository.saveFileMetadata(UUID.randomUUID().toString(), "report-2025.pdf", 2000, TEST_USER, null);
        fileRepository.saveFileMetadata(UUID.randomUUID().toString(), "image.png", 500, TEST_USER, null);

        // Search
        List<Map<String, Object>> results = fileRepository.searchFiles("report", TEST_USER);

        assertEquals(2, results.size());
        assertTrue(results.stream().allMatch(f -> ((String) f.get("name")).contains("report")));
    }

    @Test
    void testFileExistsInFolder() {
        String fileName = "unique-file.txt";
        fileRepository.saveFileMetadata(UUID.randomUUID().toString(), fileName, 100, TEST_USER, null);

        assertTrue(fileRepository.fileExistsInFolder(fileName, null, TEST_USER));
        assertFalse(fileRepository.fileExistsInFolder("nonexistent.txt", null, TEST_USER));
    }
}
