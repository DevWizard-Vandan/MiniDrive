package com.minidrive.repository;

import org.springframework.stereotype.Repository;

import javax.sql.DataSource;
import java.sql.*;
import java.util.*;

/**
 * Repository for file sharing operations.
 */
@Repository
public class ShareRepository extends BaseRepository {

	public ShareRepository(DataSource dataSource) {
		super(dataSource);
	}

	/**
	 * Create a share link for a file.
	 * @return The share token, or null if failed.
	 */
	public String createShareLink(String fileId, String username) {
		String token = UUID.randomUUID().toString().replace("-", "").substring(0, 16);

		String sql = """
            UPDATE files SET share_token = ? 
            WHERE file_id = ?::uuid AND owner_id = (SELECT id FROM users WHERE username = ?)
        """;

		try (Connection conn = getConnection();
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

	/**
	 * Revoke a share link for a file.
	 */
	public String revokeShareLink(String fileId, String username) {
		String sql = """
            UPDATE files SET share_token = NULL 
            WHERE file_id = ?::uuid AND owner_id = (SELECT id FROM users WHERE username = ?)
        """;

		try (Connection conn = getConnection();
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

	/**
	 * Get file by share token (for public access).
	 */
	public Map<String, Object> getFileByShareToken(String token) {
		String sql = "SELECT file_id, filename, size FROM files WHERE share_token = ? AND is_trashed = FALSE";

		try (Connection conn = getConnection();
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
}
