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
class FolderRepositoryTest {

    @Autowired
    private FolderRepository folderRepository;

    @Autowired
    private FileRepository fileRepository;

    @Autowired
    private DataSource dataSource;

    @org.springframework.boot.test.mock.mockito.MockBean
    private io.minio.MinioClient minioClient;

    @org.springframework.boot.test.mock.mockito.MockBean
    private org.springframework.amqp.rabbit.core.RabbitTemplate rabbitTemplate;

    private static final String TEST_USER = "testuser";
    private static final String TEST_USER_ID = UUID.randomUUID().toString();

    @BeforeEach
    void setUp() throws Exception {
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
                CREATE TABLE folders (
                    id UUID PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    parent_id UUID,
                    owner_id UUID REFERENCES users(id),
                    is_trashed BOOLEAN DEFAULT FALSE,
                    is_starred BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
                    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """);

            stmt.execute("INSERT INTO users (id, username, password) VALUES ('" + TEST_USER_ID + "', '" + TEST_USER + "', 'pass')");
        }
    }

    @Test
    void testCreateFolder_Success() {
        BaseRepository.DbResult result = folderRepository.createFolder("Documents", null, TEST_USER);
        
        assertTrue(result.success);
        assertEquals(1, result.affectedRows);
    }

    @Test
    void testCreateFolder_InvalidUser() {
        BaseRepository.DbResult result = folderRepository.createFolder("Folder", null, "nobody");
        
        assertFalse(result.success);
    }

    @Test
    void testGetFolderContents_Empty() {
        Map<String, List<Map<String, Object>>> contents = folderRepository.getFolderContents(null, TEST_USER);
        
        assertNotNull(contents);
        assertTrue(contents.get("folders").isEmpty());
        assertTrue(contents.get("files").isEmpty());
    }

    @Test
    void testGetFolderContents_WithItems() {
        // Create folders
        folderRepository.createFolder("Folder1", null, TEST_USER);
        folderRepository.createFolder("Folder2", null, TEST_USER);

        // Create files
        fileRepository.saveFileMetadata(UUID.randomUUID().toString(), "file1.txt", 100, TEST_USER, null);

        Map<String, List<Map<String, Object>>> contents = folderRepository.getFolderContents(null, TEST_USER);

        assertEquals(2, contents.get("folders").size());
        assertEquals(1, contents.get("files").size());
    }

    @Test
    void testGetFilesByFilter_Starred() {
        // This would require setting starred=true which needs more setup
        Map<String, List<Map<String, Object>>> contents = folderRepository.getFilesByFilter("starred", null, TEST_USER);
        
        assertNotNull(contents);
        assertTrue(contents.get("folders").isEmpty());
        assertTrue(contents.get("files").isEmpty());
    }
}
