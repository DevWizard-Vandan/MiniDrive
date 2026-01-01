package com.minidrive.util;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

@Component
public class DbInspector implements CommandLineRunner {

	@Autowired
	private DataSource dataSource;

	@Override
	public void run(String... args) throws Exception {
		System.out.println("\n🔍 --- DATABASE CONSTRAINT INSPECTOR ---");
		try (Connection conn = dataSource.getConnection()) {

			// Check Files Table Constraints
			checkConstraint(conn, "files");

			// Check File_Chunks Table Constraints
			checkConstraint(conn, "file_chunks");

		}
		System.out.println("----------------------------------------\n");
	}

	private void checkConstraint(Connection conn, String tableName) throws Exception {
		String sql = """
            SELECT
                tc.constraint_name, 
                rc.delete_rule
            FROM 
                information_schema.table_constraints AS tc 
            JOIN 
                information_schema.referential_constraints AS rc 
                ON tc.constraint_name = rc.constraint_name 
            WHERE 
                tc.table_name = ?
        """;

		try (PreparedStatement ps = conn.prepareStatement(sql)) {
			ps.setString(1, tableName);
			ResultSet rs = ps.executeQuery();

			System.out.println("Checking table: " + tableName.toUpperCase());
			boolean found = false;
			while (rs.next()) {
				found = true;
				String name = rs.getString("constraint_name");
				String rule = rs.getString("delete_rule");

				String status = "CASCADE".equals(rule) ? "✅ CASCADE (Correct)" : "❌ " + rule + " (Wrong)";
				System.out.printf("  - %s : %s%n", name, status);
			}
			if (!found) System.out.println("  - No Foreign Keys found (Critical Error)");
		}
	}
}