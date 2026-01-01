package com.minidrive.repository;

import org.springframework.stereotype.Repository;

import javax.sql.DataSource;
import java.sql.*;
import java.util.*;

/**
 * Repository for activity logging and retrieval.
 */
@Repository
public class ActivityRepository extends BaseRepository {

	public ActivityRepository(DataSource dataSource) {
		super(dataSource);
	}

	/**
	 * Log an activity for a user.
	 */
	public void logActivity(String username, String action, String fileName) {
		String sql = """
            INSERT INTO activities (id, user_id, action, file_name) 
            SELECT ?, id, ?, ? FROM users WHERE username = ?
        """;

		try (Connection conn = getConnection();
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

	/**
	 * Get recent activities for a user.
	 */
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

		try (Connection conn = getConnection();
			 PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setString(1, username);
			ResultSet rs = ps.executeQuery();

			while (rs.next()) {
				Map<String, Object> activity = new HashMap<>();
				activity.put("action", rs.getString("action"));
				activity.put("file", rs.getString("file_name"));
				activity.put("date", rs.getTimestamp("created_at").toString());
				logs.add(activity);
			}
		} catch (SQLException e) {
			log.error("Failed to get activities: {}", e.getMessage());
		}
		return logs;
	}
}
