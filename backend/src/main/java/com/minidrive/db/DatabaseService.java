package com.minidrive.db;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;
import org.springframework.stereotype.Service; // <--- Import this

@Service
public class DatabaseService {

	private final HikariDataSource dataSource;

	public DatabaseService() {
		// Configure Connection Pool (HikariCP)
		HikariConfig config = new HikariConfig();
		config.setJdbcUrl("jdbc:postgresql://localhost:5432/minidrive");
		config.setUsername("admin");
		config.setPassword("password123");
		config.setMaximumPoolSize(10); // Handle up to 10 concurrent DB connections

		this.dataSource = new HikariDataSource(config);

		initSchema();
	}

	private void initSchema() {
		try (Connection conn = dataSource.getConnection()) {
			// 1. Files Table
			conn.createStatement().execute("""
                CREATE TABLE IF NOT EXISTS files (
                    file_id UUID PRIMARY KEY,
                    file_name VARCHAR(255),
                    size_bytes BIGINT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """);

			// 2. Chunks Table (Maps a File to its Chunks)
			conn.createStatement().execute("""
                CREATE TABLE IF NOT EXISTS file_chunks (
                    file_id UUID,
                    chunk_hash VARCHAR(64),
                    chunk_index INT,
                    PRIMARY KEY (file_id, chunk_index)
                )
            """);
		} catch (SQLException e) {
			throw new RuntimeException("DB Init Failed", e);
		}
	}

	// Save metadata for a finished file
	public void saveFileMetadata(String fileId, String fileName, long size) {
		try (Connection conn = dataSource.getConnection()) {
			PreparedStatement ps = conn.prepareStatement(
					"INSERT INTO files (file_id, file_name, size_bytes) VALUES (?, ?, ?)"
			);
			ps.setObject(1, UUID.fromString(fileId));
			ps.setString(2, fileName);
			ps.setLong(3, size);
			ps.executeUpdate();
		} catch (SQLException e) {
			e.printStackTrace();
		}
	}

	// Check if we have this chunk globally (Deduplication Check)
	public boolean hasChunk(String hash) {
		try (Connection conn = dataSource.getConnection()) {
			PreparedStatement ps = conn.prepareStatement(
					"SELECT 1 FROM file_chunks WHERE chunk_hash = ? LIMIT 1"
			);
			ps.setString(1, hash);
			ResultSet rs = ps.executeQuery();
			return rs.next();
		} catch (SQLException e) {
			return false;
		}
	}

	// Link a chunk to a file
	public void addChunkToFile(String fileId, String chunkHash, int index) {
		try (Connection conn = dataSource.getConnection()) {
			PreparedStatement ps = conn.prepareStatement(
					"INSERT INTO file_chunks (file_id, chunk_hash, chunk_index) VALUES (?, ?, ?)"
			);
			ps.setObject(1, UUID.fromString(fileId));
			ps.setString(2, chunkHash);
			ps.setInt(3, index);
			ps.executeUpdate();
		} catch (SQLException e) {
			e.printStackTrace();
		}
	}
}