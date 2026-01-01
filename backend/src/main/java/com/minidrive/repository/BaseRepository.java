package com.minidrive.repository;

import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import javax.sql.DataSource;
import java.sql.*;

/**
 * Base repository providing common database utilities and result wrapper.
 */
@Repository
public class BaseRepository {

	protected static final Logger log = LoggerFactory.getLogger(BaseRepository.class);
	
	protected final DataSource dataSource;

	@Autowired
	public BaseRepository(DataSource dataSource) {
		this.dataSource = dataSource;
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

	/**
	 * Get user ID by username. Returns null if not found.
	 */
	protected String getUserId(Connection conn, String username) throws SQLException {
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

	/**
	 * Get user ID or throw exception if not found.
	 */
	protected String requireUserId(Connection conn, String username) throws SQLException {
		String userId = getUserId(conn, username);
		if (userId == null) {
			throw new SQLException("User not found: " + username);
		}
		return userId;
	}

	/**
	 * Get a connection from the pool.
	 */
	protected Connection getConnection() throws SQLException {
		return dataSource.getConnection();
	}
}
