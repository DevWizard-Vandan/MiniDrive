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
		HikariConfig config = new HikariConfig();

		// 1. DYNAMIC CONFIG
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

		// 2. Initialize Schema
		initDB();
	}

	public DataSource getDataSource() {
		return this.dataSource;
	}

	public void initDB() {
		try (Connection conn = dataSource.getConnection();
			 Statement stmt = conn.createStatement()) {

			// 1. Users
			stmt.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """);

			// 2. Folders (With Trash/Star columns)
			stmt.execute("""
                CREATE TABLE IF NOT EXISTS folders (
                    id UUID PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    parent_id UUID REFERENCES folders(id),
                    owner_id UUID REFERENCES users(id),
                    is_trashed BOOLEAN DEFAULT FALSE,
                    is_starred BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """);

			// 3. Files (With Trash, Star, and Share Token)
			stmt.execute("""
                CREATE TABLE IF NOT EXISTS files (
                    file_id UUID PRIMARY KEY,
                    filename VARCHAR(255),
                    size BIGINT,
                    owner_id UUID REFERENCES users(id),
                    folder_id UUID REFERENCES folders(id),
                    is_trashed BOOLEAN DEFAULT FALSE,
                    is_starred BOOLEAN DEFAULT FALSE,
                    share_token VARCHAR(64) UNIQUE,  -- <--- THIS WAS MISSING
                    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """);

			// 4. File-Chunk Mapping
			stmt.execute("""
                CREATE TABLE IF NOT EXISTS file_chunks (
                    file_id UUID REFERENCES files(file_id),
                    chunk_hash VARCHAR(64),
                    chunk_index INT,
                    PRIMARY KEY (file_id, chunk_index)
                )
            """);

			// 5. Global Chunk Index
			stmt.execute("""
                CREATE TABLE IF NOT EXISTS global_chunks (
                    chunk_hash VARCHAR(64) PRIMARY KEY,
                    ref_count INT DEFAULT 1
                )
            """);

			System.out.println("DB: Schema initialized successfully (Users + Folders + Files + Chunks + Sharing)");

		} catch (SQLException e) {
			e.printStackTrace();
		}
	}

	// --- SEARCH FEATURE ---
	public List<Map<String, Object>> searchFiles(String query, String username) {
		List<Map<String, Object>> results = new ArrayList<>();
		try (Connection conn = dataSource.getConnection()) {
			String userId = getUserId(conn, username);

			// Case-insensitive search (ILIKE is Postgres specific, use LIKE LOWER for compatibility)
			PreparedStatement ps = conn.prepareStatement(
					"SELECT file_id, filename, size, uploaded_at, is_starred FROM files " +
							"WHERE owner_id = ?::uuid AND LOWER(filename) LIKE LOWER(?)"
			);
			ps.setString(1, userId);
			ps.setString(2, "%" + query + "%");

			ResultSet rs = ps.executeQuery();
			while (rs.next()) {
				results.add(Map.of(
						"id", rs.getString("file_id"),
						"name", rs.getString("filename"),
						"size", rs.getLong("size"),
						"type", "file", // Search results don't show folders in this version
						"starred", rs.getBoolean("is_starred"),
						"date", rs.getTimestamp("uploaded_at").toString()
				));
			}
		} catch (SQLException e) { e.printStackTrace(); }
		return results;
	}

	// --- QUOTA & STATS ---
	public Map<String, Long> getUserStats(String username) {
		try (Connection conn = dataSource.getConnection()) {
			String userId = getUserId(conn, username);

			PreparedStatement ps = conn.prepareStatement(
					"SELECT COUNT(*) as cnt, COALESCE(SUM(size), 0) as total_size FROM files WHERE owner_id = ?::uuid"
			);
			ps.setString(1, userId);
			ResultSet rs = ps.executeQuery();

			if (rs.next()) {
				return Map.of(
						"count", rs.getLong("cnt"),
						"used", rs.getLong("total_size")
				);
			}
		} catch (SQLException e) { e.printStackTrace(); }
		return Map.of("count", 0L, "used", 0L);
	}

	// --- METADATA & UPLOAD METHODS ---

	public void saveFileMetadata(String fileId, String fileName, long size, String username, String folderId) {
		try (Connection conn = dataSource.getConnection()) {
			String userId = getUserId(conn, username);
			if (userId == null) {
				System.err.println("❌ ERROR: User '" + username + "' not found.");
				return;
			}

			Object folderUuid = null;
			if (folderId != null && !folderId.isEmpty() && !folderId.equals("root")) {
				try {
					folderUuid = UUID.fromString(folderId);
				} catch (IllegalArgumentException e) {
					System.err.println("⚠️ Warning: Invalid folder ID ignored: " + folderId);
				}
			}

			PreparedStatement ps = conn.prepareStatement(
					"INSERT INTO files (file_id, filename, size, owner_id, folder_id) VALUES (?, ?, ?, ?, ?)"
			);
			ps.setObject(1, UUID.fromString(fileId));
			ps.setString(2, fileName);
			ps.setLong(3, size);
			ps.setObject(4, UUID.fromString(userId));
			ps.setObject(5, folderUuid);
			ps.executeUpdate();

			System.out.println("✅ Metadata Saved: " + fileName);

		} catch (SQLException e) {
			e.printStackTrace();
			throw new RuntimeException("Database error saving file metadata", e);
		}
	}

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

	public boolean hasChunk(String hash) {
		try (Connection conn = dataSource.getConnection()) {
			PreparedStatement ps = conn.prepareStatement("SELECT 1 FROM file_chunks WHERE chunk_hash = ? LIMIT 1");
			ps.setString(1, hash);
			ResultSet rs = ps.executeQuery();
			return rs.next();
		} catch (SQLException e) {
			return false;
		}
	}

	// --- FOLDER & CONTENT METHODS ---

	public void createFolder(String folderName, String parentId, String username) {
		try (Connection conn = dataSource.getConnection()) {
			String userId = getUserId(conn, username);
			if (userId == null) return;

			PreparedStatement ps = conn.prepareStatement(
					"INSERT INTO folders (id, name, parent_id, owner_id) VALUES (?, ?, ?, ?)"
			);
			ps.setObject(1, UUID.randomUUID());
			ps.setString(2, folderName);

			if (parentId != null && !parentId.isEmpty() && !parentId.equals("root")) {
				ps.setObject(3, UUID.fromString(parentId));
			} else {
				ps.setObject(3, null);
			}

			ps.setObject(4, UUID.fromString(userId));
			ps.executeUpdate();
		} catch (SQLException e) {
			e.printStackTrace();
		}
	}

	// Main method for Drive/Folder View
	public Map<String, List<Map<String, Object>>> getFolderContents(String folderId, String username) {
		// Reuse the filter method with default args
		return getFilesByFilter(null, folderId, username);
	}

	// Powerful filter method for Trash, Recent, Starred, and Browsing
	public Map<String, List<Map<String, Object>>> getFilesByFilter(String filter, String folderId, String username) {
		Map<String, List<Map<String, Object>>> result = new HashMap<>();
		List<Map<String, Object>> folders = new ArrayList<>();
		List<Map<String, Object>> files = new ArrayList<>();

		try (Connection conn = dataSource.getConnection()) {
			String userId = getUserId(conn, username);

			String folderWhere = "owner_id = ?::uuid ";
			String fileWhere = "owner_id = ?::uuid ";

			if ("trash".equals(filter)) {
				folderWhere += "AND is_trashed = TRUE";
				fileWhere += "AND is_trashed = TRUE";
			} else if ("starred".equals(filter)) {
				folderWhere += "AND is_starred = TRUE AND is_trashed = FALSE";
				fileWhere += "AND is_starred = TRUE AND is_trashed = FALSE";
			} else if ("recent".equals(filter)) {
				folderWhere += "AND is_trashed = FALSE AND created_at > NOW() - INTERVAL '7 days'";
				fileWhere += "AND is_trashed = FALSE AND uploaded_at > NOW() - INTERVAL '7 days'";
			} else {
				// Default Navigation
				UUID parentUuid = (folderId != null && !folderId.isEmpty() && !folderId.equals("root"))
						? UUID.fromString(folderId) : null;

				folderWhere += "AND is_trashed = FALSE AND " + (parentUuid == null ? "parent_id IS NULL" : "parent_id = ?::uuid");
				fileWhere += "AND is_trashed = FALSE AND " + (parentUuid == null ? "folder_id IS NULL" : "folder_id = ?::uuid");
			}

			// 1. Get Folders
			PreparedStatement psFolder = conn.prepareStatement("SELECT id, name, created_at, is_starred FROM folders WHERE " + folderWhere);
			psFolder.setString(1, userId);

			// Only set param 2 if browsing specific folder (not trash/recent)
			if (filter == null && folderId != null && !folderId.equals("root")) {
				psFolder.setObject(2, UUID.fromString(folderId));
			}

			ResultSet rsFolder = psFolder.executeQuery();
			while (rsFolder.next()) {
				folders.add(Map.of(
						"id", rsFolder.getString("id"),
						"name", rsFolder.getString("name"),
						"type", "folder",
						"starred", rsFolder.getBoolean("is_starred"),
						"date", rsFolder.getTimestamp("created_at").toString()
				));
			}

			// 2. Get Files
			PreparedStatement psFile = conn.prepareStatement("SELECT file_id, filename, size, uploaded_at, is_starred FROM files WHERE " + fileWhere);
			psFile.setString(1, userId);

			if (filter == null && folderId != null && !folderId.equals("root")) {
				psFile.setObject(2, UUID.fromString(folderId));
			}

			ResultSet rsFile = psFile.executeQuery();
			while (rsFile.next()) {
				files.add(Map.of(
						"id", rsFile.getString("file_id"),
						"name", rsFile.getString("filename"),
						"size", rsFile.getLong("size"),
						"type", "file",
						"starred", rsFile.getBoolean("is_starred"),
						"date", rsFile.getTimestamp("uploaded_at").toString()
				));
			}

		} catch (SQLException e) {
			e.printStackTrace();
		}

		result.put("folders", folders);
		result.put("files", files);
		return result;
	}

	// --- ACTIONS (Trash/Star/Delete) ---

	public void toggleTrash(String id, boolean isFolder, boolean trash) {
		String table = isFolder ? "folders" : "files";
		String idCol = isFolder ? "id" : "file_id";
		try (Connection conn = dataSource.getConnection()) {
			PreparedStatement ps = conn.prepareStatement("UPDATE " + table + " SET is_trashed = ? WHERE " + idCol + " = ?");
			ps.setBoolean(1, trash);
			ps.setObject(2, UUID.fromString(id));
			ps.executeUpdate();
		} catch (SQLException e) { e.printStackTrace(); }
	}

	public void toggleStar(String id, boolean isFolder, boolean star) {
		String table = isFolder ? "folders" : "files";
		String idCol = isFolder ? "id" : "file_id";
		try (Connection conn = dataSource.getConnection()) {
			PreparedStatement ps = conn.prepareStatement("UPDATE " + table + " SET is_starred = ? WHERE " + idCol + " = ?");
			ps.setBoolean(1, star);
			ps.setObject(2, UUID.fromString(id));
			ps.executeUpdate();
		} catch (SQLException e) { e.printStackTrace(); }
	}

	public boolean deleteFile(String filenameOrId, String username) {
		try (Connection conn = dataSource.getConnection()) {
			// First try to delete by ID
			try {
				UUID fileId = UUID.fromString(filenameOrId);
				return deleteFileById(conn, fileId);
			} catch (IllegalArgumentException e) {
				// If not UUID, assume filename (legacy)
				Map<String, Object> meta = getFileMetadata(filenameOrId, username);
				if (meta != null) {
					return deleteFileById(conn, UUID.fromString((String) meta.get("id")));
				}
			}
			return false;
		} catch (SQLException e) {
			e.printStackTrace();
			return false;
		}
	}

	private boolean deleteFileById(Connection conn, UUID fileId) throws SQLException {
		// 1. Delete Mappings
		try (PreparedStatement ps = conn.prepareStatement("DELETE FROM file_chunks WHERE file_id = ?")) {
			ps.setObject(1, fileId);
			ps.executeUpdate();
		}
		// 2. Delete File Metadata
		try (PreparedStatement ps = conn.prepareStatement("DELETE FROM files WHERE file_id = ?")) {
			ps.setObject(1, fileId);
			return ps.executeUpdate() > 0;
		}
	}

	// --- HELPERS ---

	private String getUserId(Connection conn, String username) throws SQLException {
		PreparedStatement ps = conn.prepareStatement("SELECT id FROM users WHERE username = ?");
		ps.setString(1, username);
		ResultSet rs = ps.executeQuery();
		return rs.next() ? rs.getString("id") : null;
	}

	public List<String> getFileChunks(String fileId) {
		List<String> chunks = new ArrayList<>();
		try (Connection conn = dataSource.getConnection()) {
			PreparedStatement ps = conn.prepareStatement(
					"SELECT chunk_hash FROM file_chunks WHERE file_id = ? ORDER BY chunk_index ASC"
			);
			ps.setObject(1, UUID.fromString(fileId));
			ResultSet rs = ps.executeQuery();
			while (rs.next()) chunks.add(rs.getString("chunk_hash"));
		} catch (SQLException e) { e.printStackTrace(); }
		return chunks;
	}

	// --- PERMANENT DELETE ---
	public void deleteEntityById(String id, String username) {
		try (Connection conn = dataSource.getConnection()) {
			String userId = getUserId(conn, username);
			if (userId == null) return;

			// 1. Try deleting from files first
			// We delete chunks first to satisfy foreign keys
			PreparedStatement psChunks = conn.prepareStatement(
					"DELETE FROM file_chunks WHERE file_id = ? AND EXISTS (SELECT 1 FROM files WHERE file_id = ? AND owner_id = ?::uuid)"
			);
			psChunks.setObject(1, UUID.fromString(id));
			psChunks.setObject(2, UUID.fromString(id));
			psChunks.setString(3, userId);
			psChunks.executeUpdate();

			PreparedStatement psFile = conn.prepareStatement(
					"DELETE FROM files WHERE file_id = ? AND owner_id = ?::uuid"
			);
			psFile.setObject(1, UUID.fromString(id));
			psFile.setString(2, userId);
			int rows = psFile.executeUpdate();

			// 2. If no file deleted, try deleting folder
			if (rows == 0) {
				PreparedStatement psFolder = conn.prepareStatement(
						"DELETE FROM folders WHERE id = ? AND owner_id = ?::uuid"
				);
				psFolder.setObject(1, UUID.fromString(id));
				psFolder.setString(2, userId);
				psFolder.executeUpdate();
			}

		} catch (SQLException e) {
			e.printStackTrace();
		}
	}

	// --- MOVE LOGIC ---
	public void moveEntity(String id, boolean isFolder, String targetFolderId, String username) {
		try (Connection conn = dataSource.getConnection()) {
			String userId = getUserId(conn, username);
			if (userId == null) return;

			// Determine table and columns
			String table = isFolder ? "folders" : "files";
			String idCol = isFolder ? "id" : "file_id";
			String parentCol = isFolder ? "parent_id" : "folder_id";

			// Validate Target Folder (unless moving to root)
			Object targetUuid = null;
			if (targetFolderId != null && !targetFolderId.equals("root")) {
				targetUuid = UUID.fromString(targetFolderId);
				// Optional: Check if target folder exists and belongs to user here
			}

			PreparedStatement ps = conn.prepareStatement(
					"UPDATE " + table + " SET " + parentCol + " = ? WHERE " + idCol + " = ? AND owner_id = ?::uuid"
			);
			ps.setObject(1, targetUuid);
			ps.setObject(2, UUID.fromString(id));
			ps.setString(3, userId);
			ps.executeUpdate();

		} catch (SQLException e) {
			e.printStackTrace();
		}
	}

	// --- SHARING ---

	// 1. Generate a Share Token
	public String createShareLink(String fileId, String username) {
		String token = UUID.randomUUID().toString().substring(0, 8); // Short random ID
		try (Connection conn = dataSource.getConnection()) {
			PreparedStatement ps = conn.prepareStatement(
					"UPDATE files SET share_token = ? WHERE file_id = ? AND owner_id = (SELECT id FROM users WHERE username = ?)"
			);
			ps.setString(1, token);
			ps.setObject(2, UUID.fromString(fileId));
			ps.setString(3, username);
			ps.executeUpdate();
			return token;
		} catch (SQLException e) {
			e.printStackTrace();
			return null;
		}
	}

	// 2. Find File by Share Token (No username needed!)
	public Map<String, Object> getFileByShareToken(String token) {
		try (Connection conn = dataSource.getConnection()) {
			PreparedStatement ps = conn.prepareStatement(
					"SELECT file_id, filename, size FROM files WHERE share_token = ?"
			);
			ps.setString(1, token);
			ResultSet rs = ps.executeQuery();
			if (rs.next()) {
				return Map.of(
						"id", rs.getString("file_id"),
						"name", rs.getString("filename"),
						"size", rs.getLong("size")
				);
			}
		} catch (SQLException e) { e.printStackTrace(); }
		return null;
	}

	public Map<String, Object> getFileMetadata(String filename, String username) {
		try (Connection conn = dataSource.getConnection()) {
			PreparedStatement ps = conn.prepareStatement(
					"SELECT f.file_id, f.size FROM files f JOIN users u ON f.owner_id = u.id WHERE f.filename = ? AND u.username = ?"
			);
			ps.setString(1, filename);
			ps.setString(2, username);
			ResultSet rs = ps.executeQuery();
			if (rs.next()) {
				return Map.of("id", rs.getObject("file_id").toString(), "size", rs.getLong("size"));
			}
		} catch (SQLException e) { e.printStackTrace(); }
		return null;
	}
}