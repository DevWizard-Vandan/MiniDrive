package com.minidrive.db;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.*;
import java.util.*;

@Service
public class DatabaseService {

	private final HikariDataSource dataSource;

	public DatabaseService() {
		// Configure Connection Pool (HikariCP)
		HikariConfig config = new HikariConfig();

		// 1. DYNAMIC CONFIG: Check if we are in Docker, else use Localhost
		String envDbUrl = System.getenv("DB_URL");
		if (envDbUrl != null && !envDbUrl.isEmpty()) {
			config.setJdbcUrl(envDbUrl);
		} else {
			config.setJdbcUrl("jdbc:postgresql://localhost:5432/minidrive");
		}

		config.setUsername("admin");
		config.setPassword("password123");
		config.setMaximumPoolSize(10);

		this.dataSource = new HikariDataSource(config);

		// 2. Initialize the Single Source of Truth Schema
		initDB();
	}

	// Required for AuthService
	public DataSource getDataSource() {
		return this.dataSource;
	}

	public void initDB() {
		try (Connection conn = dataSource.getConnection();
			 Statement stmt = conn.createStatement()) {

			// 1. Users Table
			stmt.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """);

			// 2. Files Table
			stmt.execute("""
                CREATE TABLE IF NOT EXISTS files (
                    file_id UUID PRIMARY KEY,
                    filename VARCHAR(255),
                    size BIGINT,
                    owner_id UUID REFERENCES users(id),
                    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """);

			// 3. File-Chunk Mapping
			stmt.execute("""
                CREATE TABLE IF NOT EXISTS file_chunks (
                    file_id UUID REFERENCES files(file_id),
                    chunk_hash VARCHAR(64),
                    chunk_index INT,
                    PRIMARY KEY (file_id, chunk_index)
                )
            """);

			// 4. Global Chunk Index (For Deduplication)
			stmt.execute("""
                CREATE TABLE IF NOT EXISTS global_chunks (
                    chunk_hash VARCHAR(64) PRIMARY KEY,
                    ref_count INT DEFAULT 1
                )
            """);

			System.out.println("DB: Schema initialized successfully (Users + Files + Chunks)");

		} catch (SQLException e) {
			e.printStackTrace();
		}
	}

	// Save metadata for a finished file
	// NOTE: For Phase 1 (Transition), ownerId can be null if you haven't updated DriveServiceImpl yet
	public void saveFileMetadata(String fileId, String fileName, long size, String username) {
		try (Connection conn = dataSource.getConnection()) {
			// 1. Get User ID from Username
			PreparedStatement userPs = conn.prepareStatement("SELECT id FROM users WHERE username = ?");
			userPs.setString(1, username);
			ResultSet rs = userPs.executeQuery();

			if (rs.next()) {
				UUID userId = (UUID) rs.getObject("id");

				// 2. Insert File with Owner ID
				PreparedStatement ps = conn.prepareStatement(
						"INSERT INTO files (file_id, filename, size, owner_id) VALUES (?, ?, ?, ?)"
				);
				ps.setObject(1, UUID.fromString(fileId));
				ps.setString(2, fileName);
				ps.setLong(3, size);
				ps.setObject(4, userId);
				ps.executeUpdate();
			}
		} catch (SQLException e) {
			e.printStackTrace();
		}
	}

	// --- NEW: Get all files for a user ---
	public List<Map<String, Object>> getFilesByUser(String username) {
		List<Map<String, Object>> files = new ArrayList<>();
		try (Connection conn = dataSource.getConnection()) {
			PreparedStatement ps = conn.prepareStatement(
					"SELECT filename, size, uploaded_at FROM files f " +
							"JOIN users u ON f.owner_id = u.id " +
							"WHERE u.username = ? " +
							"ORDER BY f.uploaded_at DESC"
			);
			ps.setString(1, username);
			ResultSet rs = ps.executeQuery();

			while (rs.next()) {
				Map<String, Object> file = new HashMap<>();
				file.put("name", rs.getString("filename"));
				file.put("size", rs.getLong("size"));
				file.put("date", rs.getTimestamp("uploaded_at").toString());
				files.add(file);
			}
		} catch (SQLException e) {
			e.printStackTrace();
		}
		return files;
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

	public List<String> getFileChunks(String fileId) {
		List<String> chunks = new ArrayList<>();
		try (Connection conn = dataSource.getConnection()) {
			PreparedStatement ps = conn.prepareStatement(
					"SELECT chunk_hash FROM file_chunks WHERE file_id = ? ORDER BY chunk_index ASC"
			);
			ps.setObject(1, UUID.fromString(fileId));
			ResultSet rs = ps.executeQuery();
			while (rs.next()) {
				chunks.add(rs.getString("chunk_hash"));
			}
		} catch (SQLException e) {
			e.printStackTrace();
		}
		return chunks;
	}

	// Get file ID by filename and user (for download lookup)
	public Map<String, Object> getFileMetadata(String filename, String username) {
		try (Connection conn = dataSource.getConnection()) {
			PreparedStatement ps = conn.prepareStatement(
					"SELECT f.file_id, f.size FROM files f JOIN users u ON f.owner_id = u.id WHERE f.filename = ? AND u.username = ?"
			);
			ps.setString(1, filename);
			ps.setString(2, username);
			ResultSet rs = ps.executeQuery();
			if (rs.next()) {
				return Map.of(
						"id", rs.getObject("file_id").toString(),
						"size", rs.getLong("size")
				);
			}
		} catch (SQLException e) {
			e.printStackTrace();
		}
		return null;
	}

	// Delete a file (Metadata removal only)
	public boolean deleteFile(String filename, String username) {
		try (Connection conn = dataSource.getConnection()) {
			// 1. Get ID
			Map<String, Object> meta = getFileMetadata(filename, username);
			if (meta == null) return false;
			String fileId = (String) meta.get("id");

			// 2. Delete Mappings first (Foreign Key constraint)
			try (PreparedStatement ps = conn.prepareStatement("DELETE FROM file_chunks WHERE file_id = ?")) {
				ps.setObject(1, UUID.fromString(fileId));
				ps.executeUpdate();
			}

			// 3. Delete File Metadata
			try (PreparedStatement ps = conn.prepareStatement("DELETE FROM files WHERE file_id = ?")) {
				ps.setObject(1, UUID.fromString(fileId));
				ps.executeUpdate();
			}
			return true;
		} catch (SQLException e) {
			e.printStackTrace();
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