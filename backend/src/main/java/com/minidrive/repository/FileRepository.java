package com.minidrive.repository;

import org.springframework.stereotype.Repository;

import javax.sql.DataSource;
import java.sql.*;
import java.util.*;

/**
 * Repository for file operations including metadata, chunks, and search.
 */
@Repository
public class FileRepository extends BaseRepository {

	public FileRepository(DataSource dataSource) {
		super(dataSource);
	}

	// ==================== FILE METADATA ====================

	public DbResult saveFileMetadata(String fileId, String fileName, long size, String username, String folderId) {
		String sql = """
            INSERT INTO files (file_id, filename, size, owner_id, folder_id) 
            SELECT ?, ?, ?, u.id, ? 
            FROM users u WHERE u.username = ?
        """;

		try (Connection conn = getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setObject(1, UUID.fromString(fileId));
			ps.setString(2, fileName);
			ps.setLong(3, size);

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

	public Map<String, Object> getFileMetadata(String filename, String username) {
		String sql = """
            SELECT f.file_id, f.size, f.folder_id, f.is_trashed, f.uploaded_at
            FROM files f 
            JOIN users u ON f.owner_id = u.id 
            WHERE f.filename = ? AND u.username = ?
        """;

		try (Connection conn = getConnection();
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

		try (Connection conn = getConnection();
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

	// ==================== CHUNK OPERATIONS ====================

	public void addChunkToFile(String fileId, String chunkHash, int index) {
		String sql = "INSERT INTO file_chunks (file_id, chunk_hash, chunk_index) VALUES (?, ?, ?) ON CONFLICT DO NOTHING";

		try (Connection conn = getConnection();
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
		try (Connection conn = getConnection();
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

		try (Connection conn = getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setString(1, hash);
			ps.executeUpdate();

		} catch (SQLException e) {
			log.error("Failed to register chunk: {}", e.getMessage());
		}
	}

	public List<String> getFileChunks(String fileId) {
		List<String> chunks = new ArrayList<>();
		String sql = "SELECT chunk_hash FROM file_chunks WHERE file_id = ?::uuid ORDER BY chunk_index ASC";

		try (Connection conn = getConnection();
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

		try (Connection conn = getConnection();
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

	// ==================== DUPLICATE CHECK ====================

	public boolean fileExistsInFolder(String filename, String folderId, String username) {
		String sql;
		if (folderId == null || folderId.isEmpty() || folderId.equalsIgnoreCase("root")) {
			sql = """
                SELECT 1 FROM files f 
                JOIN users u ON f.owner_id = u.id 
                WHERE f.filename = ? AND u.username = ? AND f.folder_id IS NULL AND f.is_trashed = FALSE
            """;
		} else {
			sql = """
                SELECT 1 FROM files f 
                JOIN users u ON f.owner_id = u.id 
                WHERE f.filename = ? AND u.username = ? AND f.folder_id = ?::uuid AND f.is_trashed = FALSE
            """;
		}

		try (Connection conn = getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setString(1, filename);
			ps.setString(2, username);
			if (folderId != null && !folderId.isEmpty() && !folderId.equalsIgnoreCase("root")) {
				ps.setString(3, folderId);
			}

			return ps.executeQuery().next();

		} catch (SQLException e) {
			log.error("Check duplicate failed: {}", e.getMessage());
			return false;
		}
	}
}
