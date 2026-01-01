package com.minidrive.db;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.*;
import java.util.*;

@Service
public class DatabaseService {

	private static final Logger log = LoggerFactory.getLogger(DatabaseService.class);
	private final HikariDataSource dataSource;

	public DatabaseService() {
		HikariConfig config = new HikariConfig();

		String envDbUrl = System.getenv("DB_URL");
		String envDbUser = System.getenv("DB_USER");
		String envDbPass = System.getenv("DB_PASS");

		config.setJdbcUrl(envDbUrl != null && !envDbUrl.isEmpty()
				? envDbUrl : "jdbc:postgresql://localhost:5432/minidrive");
		config.setUsername(envDbUser != null ? envDbUser : "admin");
		config.setPassword(envDbPass != null ? envDbPass : "password123");
		config.setMaximumPoolSize(10);
		config.setMinimumIdle(2);
		config.setConnectionTimeout(30000);
		config.setIdleTimeout(600000);
		config.setMaxLifetime(1800000);

		this.dataSource = new HikariDataSource(config);
		initDB();
	}

	public DataSource getDataSource() {
		return this.dataSource;
	}

	// ==================== SCHEMA INITIALIZATION ====================

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

			// 2. Folders - WITH CASCADE ON SELF-REFERENCE
			stmt.execute("""
                CREATE TABLE IF NOT EXISTS folders (
                    id UUID PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    parent_id UUID,
                    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    is_trashed BOOLEAN DEFAULT FALSE,
                    is_starred BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """);

			// 3. Files
			stmt.execute("""
                CREATE TABLE IF NOT EXISTS files (
                    file_id UUID PRIMARY KEY,
                    filename VARCHAR(255),
                    size BIGINT,
                    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    folder_id UUID,
                    is_trashed BOOLEAN DEFAULT FALSE,
                    is_starred BOOLEAN DEFAULT FALSE,
                    share_token VARCHAR(64) UNIQUE,
                    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """);

			// 4. File-Chunk Mapping
			stmt.execute("""
                CREATE TABLE IF NOT EXISTS file_chunks (
                    file_id UUID,
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

			// 6. Activities
			stmt.execute("""
                CREATE TABLE IF NOT EXISTS activities (
                    id UUID PRIMARY KEY, 
                    user_id UUID REFERENCES users(id) ON DELETE CASCADE, 
                    action VARCHAR(50), 
                    file_name VARCHAR(255), 
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """);

			// Apply all CASCADE constraints properly
			applyCascadeConstraints(conn);

			log.info("✅ DB: Schema initialized.");

		} catch (SQLException e) {
			log.error("❌ DB Init Failed: {}", e.getMessage(), e);
			throw new RuntimeException("Database initialization failed", e);
		}
	}

	private void applyCascadeConstraints(Connection conn) {
		try (Statement stmt = conn.createStatement()) {

			// CASCADE: folders.parent_id -> folders.id (for recursive folder delete)
			safeExecute(stmt, "ALTER TABLE folders DROP CONSTRAINT IF EXISTS fk_folder_parent");
			safeExecute(stmt, """
                ALTER TABLE folders ADD CONSTRAINT fk_folder_parent 
                FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
            """);

			// CASCADE: files.folder_id -> folders.id
			safeExecute(stmt, "ALTER TABLE files DROP CONSTRAINT IF EXISTS fk_file_folder");
			safeExecute(stmt, "ALTER TABLE files DROP CONSTRAINT IF EXISTS files_folder_id_fkey");
			safeExecute(stmt, """
                ALTER TABLE files ADD CONSTRAINT fk_file_folder 
                FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
            """);

			// CASCADE: file_chunks.file_id -> files.file_id
			safeExecute(stmt, "ALTER TABLE file_chunks DROP CONSTRAINT IF EXISTS fk_chunk_file");
			safeExecute(stmt, "ALTER TABLE file_chunks DROP CONSTRAINT IF EXISTS file_chunks_file_id_fkey");
			safeExecute(stmt, """
                ALTER TABLE file_chunks ADD CONSTRAINT fk_chunk_file 
                FOREIGN KEY (file_id) REFERENCES files(file_id) ON DELETE CASCADE
            """);

			log.info("✅ DB: Cascade Constraints Applied Successfully.");

		} catch (SQLException e) {
			log.warn("⚠️ Constraint setup warning: {}", e.getMessage());
		}
	}

	private void safeExecute(Statement stmt, String sql) {
		try {
			stmt.execute(sql);
		} catch (SQLException e) {
			// Ignore constraint already exists or similar errors
			log.debug("SQL Note: {}", e.getMessage());
		}
	}

	// ==================== RESULT WRAPPER CLASS ====================

	public static class DbResult {
		public final boolean success;
		public final String message;
		public final int affectedRows;

		private DbResult(boolean success, String message, int affectedRows) {
			this.success = success;
			this.message = message;
			this.affectedRows = affectedRows;
		}

		public static DbResult success(int rows) {
			return new DbResult(true, "OK", rows);
		}

		public static DbResult success(String msg, int rows) {
			return new DbResult(true, msg, rows);
		}

		public static DbResult failure(String msg) {
			return new DbResult(false, msg, 0);
		}
	}

	// ==================== USER HELPERS ====================

	private String getUserId(Connection conn, String username) throws SQLException {
		if (username == null || username.isEmpty()) {
			return null;
		}
		try (PreparedStatement ps = conn.prepareStatement("SELECT id FROM users WHERE username = ?")) {
			ps.setString(1, username);
			ResultSet rs = ps.executeQuery();
			if (rs.next()) {
				return rs.getString("id");
			}
		}
		return null;
	}

	private String requireUserId(Connection conn, String username) throws SQLException {
		String userId = getUserId(conn, username);
		if (userId == null) {
			throw new SQLException("User not found: " + username);
		}
		return userId;
	}

	// ==================== ACTIVITY LOGGING ====================

	public void logActivity(String username, String action, String fileName) {
		String sql = """
            INSERT INTO activities (id, user_id, action, file_name) 
            SELECT ?, id, ?, ? FROM users WHERE username = ?
        """;

		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setObject(1, UUID.randomUUID());
			ps.setString(2, action);
			ps.setString(3, fileName);
			ps.setString(4, username);

			int rows = ps.executeUpdate();
			if (rows == 0) {
				log.warn("Activity log failed - user not found: {}", username);
			}
		} catch (SQLException e) {
			log.error("Failed to log activity: {}", e.getMessage());
		}
	}

	public List<Map<String, Object>> getActivities(String username) {
		List<Map<String, Object>> logs = new ArrayList<>();
		String sql = """
            SELECT a.action, a.file_name, a.created_at 
            FROM activities a 
            JOIN users u ON a.user_id = u.id 
            WHERE u.username = ? 
            ORDER BY a.created_at DESC 
            LIMIT 50
        """;

		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setString(1, username);
			ResultSet rs = ps.executeQuery();

			while (rs.next()) {
				Map<String, Object> log = new HashMap<>();
				log.put("action", rs.getString("action"));
				log.put("file", rs.getString("file_name"));
				log.put("date", rs.getTimestamp("created_at").toString());
				logs.add(log);
			}
		} catch (SQLException e) {
			log.error("Failed to get activities: {}", e.getMessage());
		}
		return logs;
	}

	// ==================== SEARCH ====================

	public List<Map<String, Object>> searchFiles(String query, String username) {
		List<Map<String, Object>> results = new ArrayList<>();
		String sql = """
            SELECT f.file_id, f.filename, f.size, f.uploaded_at, f.is_starred 
            FROM files f 
            JOIN users u ON f.owner_id = u.id 
            WHERE u.username = ? 
              AND LOWER(f.filename) LIKE LOWER(?) 
              AND f.is_trashed = FALSE
            ORDER BY f.uploaded_at DESC
        """;

		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setString(1, username);
			ps.setString(2, "%" + query + "%");

			ResultSet rs = ps.executeQuery();
			while (rs.next()) {
				Map<String, Object> file = new HashMap<>();
				file.put("id", rs.getString("file_id"));
				file.put("name", rs.getString("filename"));
				file.put("size", rs.getLong("size"));
				file.put("type", "file");
				file.put("starred", rs.getBoolean("is_starred"));
				file.put("date", rs.getTimestamp("uploaded_at").toString());
				results.add(file);
			}
		} catch (SQLException e) {
			log.error("Search failed: {}", e.getMessage());
		}
		return results;
	}

	// ==================== STATS ====================

	public Map<String, Long> getUserStats(String username) {
		String sql = """
            SELECT COUNT(*) as cnt, COALESCE(SUM(size), 0) as total_size 
            FROM files f 
            JOIN users u ON f.owner_id = u.id 
            WHERE u.username = ? AND f.is_trashed = FALSE
        """;

		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setString(1, username);
			ResultSet rs = ps.executeQuery();

			if (rs.next()) {
				Map<String, Long> stats = new HashMap<>();
				stats.put("count", rs.getLong("cnt"));
				stats.put("used", rs.getLong("total_size"));
				return stats;
			}
		} catch (SQLException e) {
			log.error("Stats query failed: {}", e.getMessage());
		}

		Map<String, Long> empty = new HashMap<>();
		empty.put("count", 0L);
		empty.put("used", 0L);
		return empty;
	}

	// ==================== FILE METADATA ====================

	public DbResult saveFileMetadata(String fileId, String fileName, long size, String username, String folderId) {
		String sql = """
            INSERT INTO files (file_id, filename, size, owner_id, folder_id) 
            SELECT ?, ?, ?, u.id, ? 
            FROM users u WHERE u.username = ?
        """;

		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setObject(1, UUID.fromString(fileId));
			ps.setString(2, fileName);
			ps.setLong(3, size);

			// Handle folder_id
			if (folderId != null && !folderId.isEmpty() && !folderId.equalsIgnoreCase("root")) {
				ps.setObject(4, UUID.fromString(folderId));
			} else {
				ps.setObject(4, null);
			}

			ps.setString(5, username);

			int rows = ps.executeUpdate();
			if (rows > 0) {
				log.info("✅ Metadata Saved: {} ({})", fileName, fileId);
				return DbResult.success(rows);
			} else {
				log.error("❌ Metadata save failed - user not found: {}", username);
				return DbResult.failure("User not found: " + username);
			}

		} catch (SQLException e) {
			log.error("❌ Database error saving metadata: {}", e.getMessage());
			return DbResult.failure("Database error: " + e.getMessage());
		}
	}

	public void addChunkToFile(String fileId, String chunkHash, int index) {
		String sql = "INSERT INTO file_chunks (file_id, chunk_hash, chunk_index) VALUES (?, ?, ?) ON CONFLICT DO NOTHING";

		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setObject(1, UUID.fromString(fileId));
			ps.setString(2, chunkHash);
			ps.setInt(3, index);
			ps.executeUpdate();

		} catch (SQLException e) {
			log.error("Failed to add chunk: {}", e.getMessage());
		}
	}

	public boolean hasChunk(String hash) {
		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement("SELECT 1 FROM global_chunks WHERE chunk_hash = ?")) {

			ps.setString(1, hash);
			return ps.executeQuery().next();

		} catch (SQLException e) {
			return false;
		}
	}

	public void registerGlobalChunk(String hash) {
		String sql = """
            INSERT INTO global_chunks (chunk_hash, ref_count) VALUES (?, 1)
            ON CONFLICT (chunk_hash) DO UPDATE SET ref_count = global_chunks.ref_count + 1
        """;

		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setString(1, hash);
			ps.executeUpdate();

		} catch (SQLException e) {
			log.error("Failed to register chunk: {}", e.getMessage());
		}
	}

	// ==================== FOLDER OPERATIONS ====================

	public DbResult createFolder(String folderName, String parentId, String username) {
		String sql = """
            INSERT INTO folders (id, name, parent_id, owner_id) 
            SELECT ?, ?, ?, u.id FROM users u WHERE u.username = ?
        """;

		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			UUID newFolderId = UUID.randomUUID();
			ps.setObject(1, newFolderId);
			ps.setString(2, folderName);

			if (parentId != null && !parentId.isEmpty() && !parentId.equalsIgnoreCase("root")) {
				ps.setObject(3, UUID.fromString(parentId));
			} else {
				ps.setObject(3, null);
			}

			ps.setString(4, username);

			int rows = ps.executeUpdate();
			if (rows > 0) {
				log.info("✅ Folder created: {} ({})", folderName, newFolderId);
				return DbResult.success("Folder created", rows);
			} else {
				return DbResult.failure("User not found: " + username);
			}

		} catch (SQLException e) {
			log.error("Failed to create folder: {}", e.getMessage());
			return DbResult.failure(e.getMessage());
		}
	}

	// ==================== GET CONTENTS (ROBUST VERSION) ====================

	public Map<String, List<Map<String, Object>>> getFolderContents(String folderId, String username) {
		return getFilesByFilter(null, folderId, username);
	}

	public Map<String, List<Map<String, Object>>> getFilesByFilter(String filter, String folderId, String username) {
		Map<String, List<Map<String, Object>>> result = new HashMap<>();
		List<Map<String, Object>> folders = new ArrayList<>();
		List<Map<String, Object>> files = new ArrayList<>();

		try (Connection conn = dataSource.getConnection()) {
			String userId = requireUserId(conn, username);

			// Build queries based on filter
			folders.addAll(fetchFolders(conn, userId, filter, folderId));
			files.addAll(fetchFiles(conn, userId, filter, folderId));

		} catch (SQLException e) {
			log.error("Failed to get contents: {}", e.getMessage());
		}

		result.put("folders", folders);
		result.put("files", files);
		return result;
	}

	private List<Map<String, Object>> fetchFolders(Connection conn, String userId, String filter, String folderId)
			throws SQLException {

		List<Map<String, Object>> folders = new ArrayList<>();
		StringBuilder sql = new StringBuilder(
				"SELECT id, name, created_at, is_starred, is_trashed FROM folders WHERE owner_id = ?::uuid"
		);
		List<Object> params = new ArrayList<>();
		params.add(userId);

		if ("trash".equals(filter)) {
			sql.append(" AND is_trashed = TRUE");
		} else if ("starred".equals(filter)) {
			sql.append(" AND is_starred = TRUE AND is_trashed = FALSE");
		} else if ("recent".equals(filter)) {
			sql.append(" AND is_trashed = FALSE AND created_at > NOW() - INTERVAL '7 days'");
		} else {
			sql.append(" AND is_trashed = FALSE");
			if (folderId != null && !folderId.isEmpty() && !folderId.equalsIgnoreCase("root")) {
				sql.append(" AND parent_id = ?::uuid");
				params.add(folderId);
			} else {
				sql.append(" AND parent_id IS NULL");
			}
		}

		sql.append(" ORDER BY name ASC");

		try (PreparedStatement ps = conn.prepareStatement(sql.toString())) {
			for (int i = 0; i < params.size(); i++) {
				ps.setString(i + 1, params.get(i).toString());
			}

			ResultSet rs = ps.executeQuery();
			while (rs.next()) {
				Map<String, Object> folder = new HashMap<>();
				folder.put("id", rs.getString("id"));
				folder.put("name", rs.getString("name"));
				folder.put("type", "folder");
				folder.put("starred", rs.getBoolean("is_starred"));
				folder.put("trashed", rs.getBoolean("is_trashed"));
				folder.put("date", rs.getTimestamp("created_at").toString());
				folders.add(folder);
			}
		}

		return folders;
	}

	private List<Map<String, Object>> fetchFiles(Connection conn, String userId, String filter, String folderId)
			throws SQLException {

		List<Map<String, Object>> files = new ArrayList<>();
		StringBuilder sql = new StringBuilder(
				"SELECT file_id, filename, size, uploaded_at, is_starred, is_trashed, folder_id FROM files WHERE owner_id = ?::uuid"
		);
		List<Object> params = new ArrayList<>();
		params.add(userId);

		if ("trash".equals(filter)) {
			sql.append(" AND is_trashed = TRUE");
		} else if ("starred".equals(filter)) {
			sql.append(" AND is_starred = TRUE AND is_trashed = FALSE");
		} else if ("recent".equals(filter)) {
			sql.append(" AND is_trashed = FALSE AND uploaded_at > NOW() - INTERVAL '7 days'");
		} else {
			sql.append(" AND is_trashed = FALSE");
			if (folderId != null && !folderId.isEmpty() && !folderId.equalsIgnoreCase("root")) {
				sql.append(" AND folder_id = ?::uuid");
				params.add(folderId);
			} else {
				sql.append(" AND folder_id IS NULL");
			}
		}

		sql.append(" ORDER BY filename ASC");

		try (PreparedStatement ps = conn.prepareStatement(sql.toString())) {
			for (int i = 0; i < params.size(); i++) {
				ps.setString(i + 1, params.get(i).toString());
			}

			ResultSet rs = ps.executeQuery();
			while (rs.next()) {
				Map<String, Object> file = new HashMap<>();
				file.put("id", rs.getString("file_id"));
				file.put("name", rs.getString("filename"));
				file.put("size", rs.getLong("size"));
				file.put("type", "file");
				file.put("starred", rs.getBoolean("is_starred"));
				file.put("trashed", rs.getBoolean("is_trashed"));
				file.put("date", rs.getTimestamp("uploaded_at").toString());
				file.put("folderId", rs.getString("folder_id"));
				files.add(file);
			}
		}

		return files;
	}

	// ==================== TRASH OPERATIONS (FIXED!) ====================

	public DbResult toggleTrash(String id, boolean isFolder, boolean trash, String username) {
		String table = isFolder ? "folders" : "files";
		String idCol = isFolder ? "id" : "file_id";

		String sql = "UPDATE " + table + " SET is_trashed = ? WHERE " + idCol + " = ?::uuid AND owner_id = ?::uuid";

		try (Connection conn = dataSource.getConnection()) {
			String userId = requireUserId(conn, username);

			// IMPORTANT: If restoring, check if parent folder is also trashed
			if (!trash && !isFolder) {
				DbResult parentCheck = ensureParentNotTrashed(conn, id, userId);
				if (!parentCheck.success) {
					return parentCheck;
				}
			}

			try (PreparedStatement ps = conn.prepareStatement(sql)) {
				ps.setBoolean(1, trash);
				ps.setString(2, id);
				ps.setString(3, userId);

				int rows = ps.executeUpdate();

				if (rows > 0) {
					String action = trash ? "Moved to trash" : "Restored";
					log.info("✅ {} {} (ID: {})", action, isFolder ? "folder" : "file", id);
					return DbResult.success(action, rows);
				} else {
					log.warn("⚠️ Toggle trash affected 0 rows - ID: {}, User: {}", id, username);
					return DbResult.failure("Item not found or not owned by user");
				}
			}

		} catch (SQLException e) {
			log.error("❌ Toggle trash failed: {}", e.getMessage());
			return DbResult.failure(e.getMessage());
		}
	}

	private DbResult ensureParentNotTrashed(Connection conn, String fileId, String userId) throws SQLException {
		String sql = """
            SELECT f.folder_id, fld.is_trashed as folder_trashed, fld.name as folder_name
            FROM files f
            LEFT JOIN folders fld ON f.folder_id = fld.id
            WHERE f.file_id = ?::uuid AND f.owner_id = ?::uuid
        """;

		try (PreparedStatement ps = conn.prepareStatement(sql)) {
			ps.setString(1, fileId);
			ps.setString(2, userId);
			ResultSet rs = ps.executeQuery();

			if (rs.next()) {
				String folderId = rs.getString("folder_id");
				if (folderId != null) {
					boolean folderTrashed = rs.getBoolean("folder_trashed");
					if (folderTrashed) {
						String folderName = rs.getString("folder_name");
						return DbResult.failure(
								"Cannot restore: Parent folder '" + folderName + "' is in trash. Restore the folder first."
						);
					}
				}
			}
		}
		return DbResult.success(0);
	}

	// Also restore all contents when restoring a folder
	public DbResult restoreFolderWithContents(String folderId, String username) {
		try (Connection conn = dataSource.getConnection()) {
			conn.setAutoCommit(false);

			try {
				String userId = requireUserId(conn, username);

				// Restore the folder itself
				String sqlFolder = "UPDATE folders SET is_trashed = FALSE WHERE id = ?::uuid AND owner_id = ?::uuid";
				try (PreparedStatement ps = conn.prepareStatement(sqlFolder)) {
					ps.setString(1, folderId);
					ps.setString(2, userId);
					int rows = ps.executeUpdate();
					if (rows == 0) {
						conn.rollback();
						return DbResult.failure("Folder not found or not owned by user");
					}
				}

				// Restore all files in this folder (recursive via CTE)
				String sqlFiles = """
                    WITH RECURSIVE folder_tree AS (
                        SELECT id FROM folders WHERE id = ?::uuid AND owner_id = ?::uuid
                        UNION ALL
                        SELECT f.id FROM folders f 
                        JOIN folder_tree ft ON f.parent_id = ft.id
                    )
                    UPDATE files SET is_trashed = FALSE 
                    WHERE folder_id IN (SELECT id FROM folder_tree) AND owner_id = ?::uuid
                """;
				try (PreparedStatement ps = conn.prepareStatement(sqlFiles)) {
					ps.setString(1, folderId);
					ps.setString(2, userId);
					ps.setString(3, userId);
					ps.executeUpdate();
				}

				// Restore all subfolders (recursive)
				String sqlSubFolders = """
                    WITH RECURSIVE folder_tree AS (
                        SELECT id FROM folders WHERE id = ?::uuid AND owner_id = ?::uuid
                        UNION ALL
                        SELECT f.id FROM folders f 
                        JOIN folder_tree ft ON f.parent_id = ft.id
                    )
                    UPDATE folders SET is_trashed = FALSE 
                    WHERE id IN (SELECT id FROM folder_tree) AND owner_id = ?::uuid
                """;
				try (PreparedStatement ps = conn.prepareStatement(sqlSubFolders)) {
					ps.setString(1, folderId);
					ps.setString(2, userId);
					ps.setString(3, userId);
					ps.executeUpdate();
				}

				conn.commit();
				log.info("✅ Restored folder and all contents: {}", folderId);
				return DbResult.success("Folder and contents restored", 1);

			} catch (SQLException e) {
				conn.rollback();
				throw e;
			} finally {
				conn.setAutoCommit(true);
			}

		} catch (SQLException e) {
			log.error("❌ Folder restore failed: {}", e.getMessage());
			return DbResult.failure(e.getMessage());
		}
	}

	// ==================== STAR OPERATIONS ====================

	public DbResult toggleStar(String id, boolean isFolder, boolean star, String username) {
		String table = isFolder ? "folders" : "files";
		String idCol = isFolder ? "id" : "file_id";

		String sql = "UPDATE " + table + " SET is_starred = ? WHERE " + idCol + " = ?::uuid AND owner_id = ?::uuid";

		try (Connection conn = dataSource.getConnection()) {
			String userId = requireUserId(conn, username);

			try (PreparedStatement ps = conn.prepareStatement(sql)) {
				ps.setBoolean(1, star);
				ps.setString(2, id);
				ps.setString(3, userId);

				int rows = ps.executeUpdate();

				if (rows > 0) {
					log.info("✅ {} {} (ID: {})", star ? "Starred" : "Unstarred", isFolder ? "folder" : "file", id);
					return DbResult.success(rows);
				} else {
					return DbResult.failure("Item not found or not owned by user");
				}
			}

		} catch (SQLException e) {
			log.error("❌ Toggle star failed: {}", e.getMessage());
			return DbResult.failure(e.getMessage());
		}
	}

	// ==================== DELETE OPERATIONS (FIXED!) ====================

	public DbResult deleteEntityById(String id, String username) {
		try (Connection conn = dataSource.getConnection()) {
			conn.setAutoCommit(false);

			try {
				String userId = requireUserId(conn, username);

				// First, try to delete as a FILE
				if (tryDeleteFile(conn, id, userId)) {
					conn.commit();
					log.info("✅ Deleted file: {}", id);
					return DbResult.success("File deleted", 1);
				}

				// If not a file, try as a FOLDER (cascade will handle contents)
				if (tryDeleteFolder(conn, id, userId)) {
					conn.commit();
					log.info("✅ Deleted folder and all contents: {}", id);
					return DbResult.success("Folder deleted", 1);
				}

				conn.rollback();
				return DbResult.failure("Item not found or not owned by user");

			} catch (SQLException e) {
				conn.rollback();
				throw e;
			} finally {
				conn.setAutoCommit(true);
			}

		} catch (SQLException e) {
			log.error("❌ Delete failed: {}", e.getMessage());
			return DbResult.failure(e.getMessage());
		}
	}

	private boolean tryDeleteFile(Connection conn, String fileId, String userId) throws SQLException {
		// First verify ownership
		String checkSql = "SELECT 1 FROM files WHERE file_id = ?::uuid AND owner_id = ?::uuid";
		try (PreparedStatement ps = conn.prepareStatement(checkSql)) {
			ps.setString(1, fileId);
			ps.setString(2, userId);
			if (!ps.executeQuery().next()) {
				return false; // Not a file or not owned
			}
		}

		// Delete file (chunks cascade automatically)
		String deleteSql = "DELETE FROM files WHERE file_id = ?::uuid AND owner_id = ?::uuid";
		try (PreparedStatement ps = conn.prepareStatement(deleteSql)) {
			ps.setString(1, fileId);
			ps.setString(2, userId);
			return ps.executeUpdate() > 0;
		}
	}

	private boolean tryDeleteFolder(Connection conn, String folderId, String userId) throws SQLException {
		// First verify ownership
		String checkSql = "SELECT 1 FROM folders WHERE id = ?::uuid AND owner_id = ?::uuid";
		try (PreparedStatement ps = conn.prepareStatement(checkSql)) {
			ps.setString(1, folderId);
			ps.setString(2, userId);
			if (!ps.executeQuery().next()) {
				return false; // Not a folder or not owned
			}
		}

		// CASCADE delete will automatically delete:
		// - All subfolders (due to fk_folder_parent CASCADE)
		// - All files in folder and subfolders (due to fk_file_folder CASCADE)
		// - All file_chunks (due to fk_chunk_file CASCADE)
		String deleteSql = "DELETE FROM folders WHERE id = ?::uuid AND owner_id = ?::uuid";
		try (PreparedStatement ps = conn.prepareStatement(deleteSql)) {
			ps.setString(1, folderId);
			ps.setString(2, userId);
			return ps.executeUpdate() > 0;
		}
	}

	// Permanently delete all items in trash
	public DbResult emptyTrash(String username) {
		try (Connection conn = dataSource.getConnection()) {
			conn.setAutoCommit(false);

			try {
				String userId = requireUserId(conn, username);
				int totalDeleted = 0;

				// Delete trashed files first
				String deleteFiles = "DELETE FROM files WHERE owner_id = ?::uuid AND is_trashed = TRUE";
				try (PreparedStatement ps = conn.prepareStatement(deleteFiles)) {
					ps.setString(1, userId);
					totalDeleted += ps.executeUpdate();
				}

				// Delete trashed folders (only root-level trashed folders, cascade handles rest)
				String deleteFolders = "DELETE FROM folders WHERE owner_id = ?::uuid AND is_trashed = TRUE";
				try (PreparedStatement ps = conn.prepareStatement(deleteFolders)) {
					ps.setString(1, userId);
					totalDeleted += ps.executeUpdate();
				}

				conn.commit();
				log.info("✅ Emptied trash for user {}: {} items deleted", username, totalDeleted);
				return DbResult.success("Trash emptied", totalDeleted);

			} catch (SQLException e) {
				conn.rollback();
				throw e;
			} finally {
				conn.setAutoCommit(true);
			}

		} catch (SQLException e) {
			log.error("❌ Empty trash failed: {}", e.getMessage());
			return DbResult.failure(e.getMessage());
		}
	}

	// ==================== MOVE OPERATIONS ====================

	public DbResult moveEntity(String id, boolean isFolder, String targetFolderId, String username) {
		String table = isFolder ? "folders" : "files";
		String idCol = isFolder ? "id" : "file_id";
		String parentCol = isFolder ? "parent_id" : "folder_id";

		try (Connection conn = dataSource.getConnection()) {
			String userId = requireUserId(conn, username);

			// Validate target folder exists and is owned by user (if not root)
			UUID targetUuid = null;
			if (targetFolderId != null && !targetFolderId.isEmpty() && !targetFolderId.equalsIgnoreCase("root")) {
				targetUuid = UUID.fromString(targetFolderId);

				String checkTarget = "SELECT 1 FROM folders WHERE id = ?::uuid AND owner_id = ?::uuid AND is_trashed = FALSE";
				try (PreparedStatement ps = conn.prepareStatement(checkTarget)) {
					ps.setObject(1, targetUuid);
					ps.setString(2, userId);
					if (!ps.executeQuery().next()) {
						return DbResult.failure("Target folder not found or inaccessible");
					}
				}

				// Prevent moving folder into itself or its subfolder
				if (isFolder && wouldCreateCycle(conn, id, targetFolderId)) {
					return DbResult.failure("Cannot move folder into itself or its subfolder");
				}
			}

			String sql = "UPDATE " + table + " SET " + parentCol + " = ? WHERE " + idCol + " = ?::uuid AND owner_id = ?::uuid";
			try (PreparedStatement ps = conn.prepareStatement(sql)) {
				ps.setObject(1, targetUuid);
				ps.setString(2, id);
				ps.setString(3, userId);

				int rows = ps.executeUpdate();
				if (rows > 0) {
					log.info("✅ Moved {} to folder: {}", id, targetFolderId);
					return DbResult.success(rows);
				} else {
					return DbResult.failure("Item not found or not owned by user");
				}
			}

		} catch (SQLException e) {
			log.error("❌ Move failed: {}", e.getMessage());
			return DbResult.failure(e.getMessage());
		}
	}

	private boolean wouldCreateCycle(Connection conn, String folderId, String targetFolderId) throws SQLException {
		// Check if targetFolderId is a descendant of folderId
		String sql = """
            WITH RECURSIVE folder_tree AS (
                SELECT id, parent_id FROM folders WHERE id = ?::uuid
                UNION ALL
                SELECT f.id, f.parent_id FROM folders f 
                JOIN folder_tree ft ON f.parent_id = ft.id
            )
            SELECT 1 FROM folder_tree WHERE id = ?::uuid
        """;

		try (PreparedStatement ps = conn.prepareStatement(sql)) {
			ps.setString(1, folderId);
			ps.setString(2, targetFolderId);
			return ps.executeQuery().next();
		}
	}

	// ==================== SHARE OPERATIONS ====================

	public String createShareLink(String fileId, String username) {
		String token = UUID.randomUUID().toString().replace("-", "").substring(0, 16);

		String sql = """
            UPDATE files SET share_token = ? 
            WHERE file_id = ?::uuid AND owner_id = (SELECT id FROM users WHERE username = ?)
        """;

		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setString(1, token);
			ps.setString(2, fileId);
			ps.setString(3, username);

			int rows = ps.executeUpdate();
			if (rows > 0) {
				log.info("✅ Share link created for file: {}", fileId);
				return token;
			} else {
				log.warn("⚠️ Share link creation failed - file not found: {}", fileId);
				return null;
			}

		} catch (SQLException e) {
			log.error("❌ Share link creation failed: {}", e.getMessage());
			return null;
		}
	}

	public String revokeShareLink(String fileId, String username) {
		String sql = """
            UPDATE files SET share_token = NULL 
            WHERE file_id = ?::uuid AND owner_id = (SELECT id FROM users WHERE username = ?)
        """;

		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setString(1, fileId);
			ps.setString(2, username);

			int rows = ps.executeUpdate();
			return rows > 0 ? "Share link revoked" : "File not found";

		} catch (SQLException e) {
			log.error("❌ Revoke share failed: {}", e.getMessage());
			return null;
		}
	}

	public Map<String, Object> getFileByShareToken(String token) {
		String sql = "SELECT file_id, filename, size FROM files WHERE share_token = ? AND is_trashed = FALSE";

		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setString(1, token);
			ResultSet rs = ps.executeQuery();

			if (rs.next()) {
				Map<String, Object> file = new HashMap<>();
				file.put("id", rs.getString("file_id"));
				file.put("name", rs.getString("filename"));
				file.put("size", rs.getLong("size"));
				return file;
			}

		} catch (SQLException e) {
			log.error("❌ Get shared file failed: {}", e.getMessage());
		}
		return null;
	}

	// ==================== RECURSIVE FOLDER DOWNLOAD ====================

	public List<Map<String, Object>> getFilesRecursive(String folderId, String username) {
		List<Map<String, Object>> files = new ArrayList<>();

		String sql = """
            WITH RECURSIVE folder_tree AS (
                SELECT id, name, CAST(name AS TEXT) as path
                FROM folders 
                WHERE id = ?::uuid AND owner_id = (SELECT id FROM users WHERE username = ?)
                
                UNION ALL
                
                SELECT f.id, f.name, ft.path || '/' || f.name
                FROM folders f 
                JOIN folder_tree ft ON f.parent_id = ft.id
                WHERE f.is_trashed = FALSE
            )
            SELECT 
                fl.file_id, 
                fl.filename, 
                fl.size, 
                ft.path || '/' || fl.filename as zip_path
            FROM files fl 
            JOIN folder_tree ft ON fl.folder_id = ft.id
            WHERE fl.is_trashed = FALSE
        """;

		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setString(1, folderId);
			ps.setString(2, username);

			ResultSet rs = ps.executeQuery();
			while (rs.next()) {
				Map<String, Object> file = new HashMap<>();
				file.put("id", rs.getString("file_id"));
				file.put("name", rs.getString("filename"));
				file.put("size", rs.getLong("size"));
				file.put("zipPath", rs.getString("zip_path"));
				files.add(file);
			}

		} catch (SQLException e) {
			log.error("❌ Recursive file fetch failed: {}", e.getMessage());
		}

		return files;
	}

	// ==================== FILE METADATA & CHUNKS ====================

	public Map<String, Object> getFileMetadata(String filename, String username) {
		String sql = """
            SELECT f.file_id, f.size, f.folder_id, f.is_trashed, f.uploaded_at
            FROM files f 
            JOIN users u ON f.owner_id = u.id 
            WHERE f.filename = ? AND u.username = ?
        """;

		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setString(1, filename);
			ps.setString(2, username);
			ResultSet rs = ps.executeQuery();

			if (rs.next()) {
				Map<String, Object> meta = new HashMap<>();
				meta.put("id", rs.getString("file_id"));
				meta.put("size", rs.getLong("size"));
				meta.put("folderId", rs.getString("folder_id"));
				meta.put("trashed", rs.getBoolean("is_trashed"));
				meta.put("uploadedAt", rs.getTimestamp("uploaded_at").toString());
				return meta;
			}

		} catch (SQLException e) {
			log.error("❌ Get file metadata failed: {}", e.getMessage());
		}
		return null;
	}

	public Map<String, Object> getFileMetadataById(String fileId, String username) {
		String sql = """
            SELECT f.file_id, f.filename, f.size, f.folder_id, f.is_trashed, f.uploaded_at
            FROM files f 
            JOIN users u ON f.owner_id = u.id 
            WHERE f.file_id = ?::uuid AND u.username = ?
        """;

		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setString(1, fileId);
			ps.setString(2, username);
			ResultSet rs = ps.executeQuery();

			if (rs.next()) {
				Map<String, Object> meta = new HashMap<>();
				meta.put("id", rs.getString("file_id"));
				meta.put("name", rs.getString("filename"));
				meta.put("size", rs.getLong("size"));
				meta.put("folderId", rs.getString("folder_id"));
				meta.put("trashed", rs.getBoolean("is_trashed"));
				meta.put("uploadedAt", rs.getTimestamp("uploaded_at").toString());
				return meta;
			}

		} catch (SQLException e) {
			log.error("❌ Get file metadata by ID failed: {}", e.getMessage());
		}
		return null;
	}

	public List<String> getFileChunks(String fileId) {
		List<String> chunks = new ArrayList<>();
		String sql = "SELECT chunk_hash FROM file_chunks WHERE file_id = ?::uuid ORDER BY chunk_index ASC";

		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setString(1, fileId);
			ResultSet rs = ps.executeQuery();

			while (rs.next()) {
				chunks.add(rs.getString("chunk_hash"));
			}

		} catch (SQLException e) {
			log.error("❌ Get file chunks failed: {}", e.getMessage());
		}

		return chunks;
	}

	// ==================== DUPLICATE CHECK ====================

	public boolean fileExistsInFolder(String filename, String folderId, String username) {
		StringBuilder sql = new StringBuilder("""
            SELECT 1 FROM files f 
            JOIN users u ON f.owner_id = u.id 
            WHERE f.filename = ? AND u.username = ? AND f.is_trashed = FALSE
        """);

		List<Object> params = new ArrayList<>();
		params.add(filename);
		params.add(username);

		if (folderId != null && !folderId.isEmpty() && !folderId.equalsIgnoreCase("root")) {
			sql.append(" AND f.folder_id = ?::uuid");
			params.add(folderId);
		} else {
			sql.append(" AND f.folder_id IS NULL");
		}

		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql.toString())) {

			for (int i = 0; i < params.size(); i++) {
				ps.setString(i + 1, params.get(i).toString());
			}

			return ps.executeQuery().next();

		} catch (SQLException e) {
			log.error("❌ File exists check failed: {}", e.getMessage());
			return false;
		}
	}

	// ==================== RENAME OPERATION ====================

	public DbResult renameEntity(String id, boolean isFolder, String newName, String username) {
		String table = isFolder ? "folders" : "files";
		String idCol = isFolder ? "id" : "file_id";
		String nameCol = isFolder ? "name" : "filename";

		String sql = "UPDATE " + table + " SET " + nameCol + " = ? WHERE " + idCol + " = ?::uuid AND owner_id = ?::uuid";

		try (Connection conn = dataSource.getConnection()) {
			String userId = requireUserId(conn, username);

			try (PreparedStatement ps = conn.prepareStatement(sql)) {
				ps.setString(1, newName);
				ps.setString(2, id);
				ps.setString(3, userId);

				int rows = ps.executeUpdate();
				if (rows > 0) {
					log.info("✅ Renamed to: {}", newName);
					return DbResult.success(rows);
				} else {
					return DbResult.failure("Item not found or not owned by user");
				}
			}

		} catch (SQLException e) {
			log.error("❌ Rename failed: {}", e.getMessage());
			return DbResult.failure(e.getMessage());
		}
	}

	// ==================== HEALTH CHECK ====================

	public boolean isHealthy() {
		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement("SELECT 1")) {
			return ps.executeQuery().next();
		} catch (SQLException e) {
			log.error("❌ Database health check failed: {}", e.getMessage());
			return false;
		}
	}

	// ==================== ACCOUNT DELETION ====================

	/**
	 * Permanently deletes a user account and ALL associated data.
	 * Due to CASCADE constraints, this will automatically delete:
	 * - All user's files
	 * - All user's folders  
	 * - All user's file chunks
	 * - All user's activity logs
	 */
	public DbResult deleteAccount(String username) {
		String sql = "DELETE FROM users WHERE username = ?";
		
		try (Connection conn = dataSource.getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {
			
			ps.setString(1, username);
			int deleted = ps.executeUpdate();
			
			if (deleted > 0) {
				log.info("🗑️ Account deleted: {}", username);
				return DbResult.success("Account permanently deleted", deleted);
			} else {
				return DbResult.failure("User not found");
			}
		} catch (SQLException e) {
			log.error("❌ Failed to delete account: {}", e.getMessage());
			return DbResult.failure("Failed to delete account: " + e.getMessage());
		}
	}

	// ==================== CLEANUP ====================

	public void shutdown() {
		if (dataSource != null && !dataSource.isClosed()) {
			dataSource.close();
			log.info("✅ Database connection pool closed");
		}
	}
}