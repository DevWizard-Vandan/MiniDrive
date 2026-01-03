package com.minidrive.repository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Repository;

import javax.sql.DataSource;
import java.sql.*;
import java.util.*;

/**
 * Repository for tracking file versions in PostgreSQL.
 * Stores version metadata (the actual files are in MinIO versioned bucket).
 */
@Repository
public class FileVersionRepository extends BaseRepository {

    private static final Logger logger = LoggerFactory.getLogger(FileVersionRepository.class);

    public FileVersionRepository(DataSource dataSource) {
        super(dataSource);
    }

    /**
     * Initialize file_versions table if it doesn't exist.
     */
    public void initializeTable() {
        String sql = """
            CREATE TABLE IF NOT EXISTS file_versions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                file_id UUID NOT NULL,
                version_number INT NOT NULL,
                minio_version_id VARCHAR(255),
                size BIGINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                comment TEXT,
                UNIQUE(file_id, version_number)
            )
        """;
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute(sql);
            logger.info("FileVersionRepository: file_versions table initialized");
        } catch (SQLException e) {
            logger.warn("Failed to initialize file_versions table: {}", e.getMessage());
        }
    }

    /**
     * Record a new version of a file.
     * 
     * @return The new version number
     */
    public int recordVersion(String fileId, String minioVersionId, long size, String comment) {
        // Get current max version number
        int nextVersion = getLatestVersionNumber(fileId) + 1;

        String sql = """
            INSERT INTO file_versions (file_id, version_number, minio_version_id, size, comment)
            VALUES (?::uuid, ?, ?, ?, ?)
        """;

        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, fileId);
            stmt.setInt(2, nextVersion);
            stmt.setString(3, minioVersionId);
            stmt.setLong(4, size);
            stmt.setString(5, comment);
            stmt.executeUpdate();
            logger.info("Recorded version {} for file {}", nextVersion, fileId);
            return nextVersion;
        } catch (SQLException e) {
            logger.error("Failed to record version: {}", e.getMessage());
            return -1;
        }
    }

    /**
     * Get the latest version number for a file.
     */
    public int getLatestVersionNumber(String fileId) {
        String sql = "SELECT COALESCE(MAX(version_number), 0) FROM file_versions WHERE file_id = ?::uuid";
        
        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, fileId);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return rs.getInt(1);
            }
        } catch (SQLException e) {
            logger.error("Failed to get latest version: {}", e.getMessage());
        }
        return 0;
    }

    /**
     * Get all versions of a file.
     */
    public List<Map<String, Object>> getVersions(String fileId) {
        String sql = """
            SELECT version_number, minio_version_id, size, created_at, comment
            FROM file_versions
            WHERE file_id = ?::uuid
            ORDER BY version_number DESC
        """;

        List<Map<String, Object>> versions = new ArrayList<>();
        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, fileId);
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                Map<String, Object> version = new HashMap<>();
                version.put("versionNumber", rs.getInt("version_number"));
                version.put("minioVersionId", rs.getString("minio_version_id"));
                version.put("size", rs.getLong("size"));
                version.put("createdAt", rs.getTimestamp("created_at").toString());
                version.put("comment", rs.getString("comment"));
                versions.add(version);
            }
        } catch (SQLException e) {
            logger.error("Failed to get versions: {}", e.getMessage());
        }
        return versions;
    }

    /**
     * Get a specific version's MinIO version ID.
     */
    public String getMinioVersionId(String fileId, int versionNumber) {
        String sql = """
            SELECT minio_version_id FROM file_versions
            WHERE file_id = ?::uuid AND version_number = ?
        """;

        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, fileId);
            stmt.setInt(2, versionNumber);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return rs.getString("minio_version_id");
            }
        } catch (SQLException e) {
            logger.error("Failed to get MinIO version ID: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Delete a version record.
     */
    public boolean deleteVersion(String fileId, int versionNumber) {
        String sql = "DELETE FROM file_versions WHERE file_id = ?::uuid AND version_number = ?";
        
        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, fileId);
            stmt.setInt(2, versionNumber);
            int affected = stmt.executeUpdate();
            return affected > 0;
        } catch (SQLException e) {
            logger.error("Failed to delete version: {}", e.getMessage());
            return false;
        }
    }
}
