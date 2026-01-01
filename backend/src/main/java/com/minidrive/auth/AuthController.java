package com.minidrive.auth;

import com.minidrive.db.DatabaseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:3000")
public class AuthController {

	@Autowired
	private AuthService authService;

	@Autowired
	private DatabaseService databaseService;

	@PostMapping("/register")
	public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
		try {
			String token = authService.register(body.get("username"), body.get("password"));
			return ResponseEntity.ok(Map.of("token", token));
		} catch (Exception e) {
			return ResponseEntity.badRequest().body(e.getMessage());
		}
	}

	@PostMapping("/login")
	public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
		try {
			String token = authService.login(body.get("username"), body.get("password"));
			return ResponseEntity.ok(Map.of("token", token));
		} catch (Exception e) {
			return ResponseEntity.status(401).body(e.getMessage());
		}
	}

	/**
	 * Permanently delete the authenticated user's account.
	 * REQUIRES PASSWORD CONFIRMATION for security.
	 */
	@DeleteMapping("/account")
	public ResponseEntity<?> deleteAccount(
			@RequestBody(required = false) Map<String, String> body,
			Authentication auth) {
		
		if (auth == null) {
			return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
		}

		// Require password confirmation
		String password = body != null ? body.get("password") : null;
		if (password == null || password.isEmpty()) {
			return ResponseEntity.badRequest().body(Map.of(
				"error", "Password required for account deletion"
			));
		}

		String username = auth.getName();
		
		// Verify password before deletion
		if (!authService.verifyPassword(username, password)) {
			return ResponseEntity.status(403).body(Map.of(
				"error", "Incorrect password"
			));
		}

		DatabaseService.DbResult result = databaseService.deleteAccount(username);

		if (result.success) {
			return ResponseEntity.ok(Map.of(
				"message", "Account permanently deleted",
				"logout", true
			));
		} else {
			return ResponseEntity.badRequest().body(Map.of(
				"error", result.message
			));
		}
	}
}