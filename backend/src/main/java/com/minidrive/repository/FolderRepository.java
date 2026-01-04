package com.minidrive.repository;

import org.springframework.stereotype.Repository;

import javax.sql.DataSource;
import java.sql.*;
import java.util.*;

/**
 * Repository for folder operations including CRUD and content listing.
 */
@Repository
public class FolderRepository extends BaseRepository {

	public FolderRepository(DataSource dataSource) {
		super(dataSource);
	}

	// ==================== FOLDER CRUD ====================

	public DbResult createFolder(String folderName, String parentId, String username) {
		String sql = """
            INSERT INTO folders (id, name, parent_id, owner_id) 
            SELECT ?, ?, ?, u.id FROM users u WHERE u.username = ?
        """;

		try (Connection conn = getConnection();
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

	// ==================== GET CONTENTS ====================

	public Map<String, List<Map<String, Object>>> getFolderContents(String folderId, String username) {
		return getFilesByFilter(null, folderId, username);
	}

	public Map<String, List<Map<String, Object>>> getFilesByFilter(String filter, String folderId, String username) {
		Map<String, List<Map<String, Object>>> result = new HashMap<>();
		List<Map<String, Object>> folders = new ArrayList<>();
		List<Map<String, Object>> files = new ArrayList<>();

		try (Connection conn = getConnection()) {
			String userId = requireUserId(conn, username);

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
				"SELECT id, name, created_at, is_starred, is_trashed, is_vault FROM folders WHERE owner_id = ?::uuid"
		);
		List<Object> params = new ArrayList<>();
		params.add(userId);

		if ("trash".equals(filter)) {
			sql.append(" AND is_trashed = TRUE");
		} else if ("vault".equals(filter)) {
			sql.append(" AND is_vault = TRUE AND is_trashed = FALSE");
			// Support navigating into folders within vault
			if (folderId != null && !folderId.isEmpty() && !folderId.equalsIgnoreCase("root")) {
				sql.append(" AND parent_id = ?::uuid");
				params.add(folderId);
			} else {
				sql.append(" AND parent_id IS NULL");
			}
		} else if ("starred".equals(filter)) {
			sql.append(" AND is_starred = TRUE AND is_trashed = FALSE AND is_vault = FALSE");
		} else if ("recent".equals(filter)) {
			sql.append(" AND is_trashed = FALSE AND is_vault = FALSE AND created_at > NOW() - INTERVAL '7 days'");
		} else {
			sql.append(" AND is_trashed = FALSE AND is_vault = FALSE");
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
				folder.put("vault", rs.getBoolean("is_vault"));
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
				"SELECT file_id, filename, size, uploaded_at, is_starred, is_trashed, is_vault, folder_id FROM files WHERE owner_id = ?::uuid"
		);
		List<Object> params = new ArrayList<>();
		params.add(userId);

		if ("trash".equals(filter)) {
			sql.append(" AND is_trashed = TRUE");
		} else if ("vault".equals(filter)) {
			sql.append(" AND is_vault = TRUE AND is_trashed = FALSE");
			// Support navigating into folders within vault
			if (folderId != null && !folderId.isEmpty() && !folderId.equalsIgnoreCase("root")) {
				sql.append(" AND folder_id = ?::uuid");
				params.add(folderId);
			} else {
				sql.append(" AND folder_id IS NULL");
			}
		} else if ("starred".equals(filter)) {
			sql.append(" AND is_starred = TRUE AND is_trashed = FALSE AND is_vault = FALSE");
		} else if ("recent".equals(filter)) {
			sql.append(" AND is_trashed = FALSE AND is_vault = FALSE AND uploaded_at > NOW() - INTERVAL '7 days'");
		} else {
			sql.append(" AND is_trashed = FALSE AND is_vault = FALSE");
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
				file.put("vault", rs.getBoolean("is_vault"));
				file.put("date", rs.getTimestamp("uploaded_at").toString());
				file.put("folderId", rs.getString("folder_id"));
				files.add(file);
			}
		}

		return files;
	}
}
