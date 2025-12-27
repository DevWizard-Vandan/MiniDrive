package com.minidrive.auth;

import com.minidrive.db.DatabaseService;
import io.jsonwebtoken.Claims; // Import
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets; // Import
import java.security.Key;
import java.sql.*;
import java.util.Date;
import java.util.UUID;

@Service
public class AuthService {

	@Autowired
	private DatabaseService db;

	private final PasswordEncoder encoder = new BCryptPasswordEncoder();

	// FIX: Use a HARDCODED secret so it persists across restarts.
	// In production, this goes in env variables.
	private static final String SECRET_STRING = "ThisIsASecretKeyForMiniDriveProjectThatMustBeLongEnough123456";
	private final Key key = Keys.hmacShaKeyFor(SECRET_STRING.getBytes(StandardCharsets.UTF_8));

	public String register(String username, String password) throws Exception {
		try (Connection conn = db.getDataSource().getConnection()) {
			PreparedStatement check = conn.prepareStatement("SELECT id FROM users WHERE username = ?");
			check.setString(1, username);
			if (check.executeQuery().next()) throw new RuntimeException("User already exists");

			String id = UUID.randomUUID().toString();
			PreparedStatement ps = conn.prepareStatement("INSERT INTO users (id, username, password) VALUES (?, ?, ?)");
			ps.setObject(1, UUID.fromString(id));
			ps.setString(2, username);
			ps.setString(3, encoder.encode(password));
			ps.executeUpdate();

			return generateToken(username);
		}
	}

	public String login(String username, String password) throws Exception {
		try (Connection conn = db.getDataSource().getConnection()) {
			PreparedStatement ps = conn.prepareStatement("SELECT password FROM users WHERE username = ?");
			ps.setString(1, username);
			ResultSet rs = ps.executeQuery();

			if (rs.next()) {
				String hashed = rs.getString("password");
				if (encoder.matches(password, hashed)) {
					return generateToken(username);
				}
			}
			throw new RuntimeException("Invalid credentials");
		}
	}

	private String generateToken(String username) {
		return Jwts.builder()
				.setSubject(username)
				.setIssuedAt(new Date())
				.setExpiration(new Date(System.currentTimeMillis() + 1000 * 60 * 60 * 10)) // 10 hours
				.signWith(key)
				.compact();
	}

	// --- NEW: Method to Validate Token ---
	public String validateTokenAndGetUsername(String token) {
		try {
			Claims claims = Jwts.parserBuilder()
					.setSigningKey(key)
					.build()
					.parseClaimsJws(token)
					.getBody();
			return claims.getSubject();
		} catch (Exception e) {
			return null; // Invalid token
		}
	}
}