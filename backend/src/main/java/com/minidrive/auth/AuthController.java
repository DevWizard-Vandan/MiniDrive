package com.minidrive.auth;

import com.minidrive.db.DatabaseService;
import com.minidrive.service.PasskeyService;
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

	@Autowired
	private PasskeyService passkeyService;

	@PostMapping("/register")
	public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
		try {
			String token = authService.register(body.get("username"), body.get("password"));
			return ResponseEntity.ok(Map.of("token", token));
		} catch (Exception e) {
			return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
		}
	}

	@PostMapping("/login")
	public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
		try {
			String token = authService.login(body.get("username"), body.get("password"));
			return ResponseEntity.ok(Map.of("token", token));
		} catch (Exception e) {
			return ResponseEntity.status(401).body(Map.of("message", e.getMessage()));
		}
	}

	// ==================== PASSKEY (WebAuthn) ENDPOINTS ====================

	/**
	 * Get passkey registration options.
	 */
	@PostMapping("/passkey/register-options")
	public ResponseEntity<?> getPasskeyRegistrationOptions(@RequestBody Map<String, String> body) {
		String username = body.get("username");
		if (username == null || username.isEmpty()) {
			return ResponseEntity.badRequest().body(Map.of("error", "Username required"));
		}
		
		// Get or generate user ID
		String userId = databaseService.getUserId(username);
		if (userId == null) {
			return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
		}

		Map<String, Object> options = passkeyService.generateRegistrationOptions(username, userId);
		return ResponseEntity.ok(options);
	}

	/**
	 * Verify passkey registration.
	 */
	@PostMapping("/passkey/register-verify")
	@SuppressWarnings("unchecked")
	public ResponseEntity<?> verifyPasskeyRegistration(@RequestBody Map<String, Object> body) {
		String username = (String) body.get("username");
		Map<String, Object> credential = (Map<String, Object>) body.get("credential");

		String userId = databaseService.getUserId(username);
		if (userId == null) {
			return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
		}

		boolean verified = passkeyService.verifyRegistration(username, userId, credential);
		if (verified) {
			return ResponseEntity.ok(Map.of("success", true, "message", "Passkey registered"));
		} else {
			return ResponseEntity.badRequest().body(Map.of("error", "Registration failed"));
		}
	}

	/**
	 * Get passkey authentication options.
	 */
	@PostMapping("/passkey/login-options")
	public ResponseEntity<?> getPasskeyLoginOptions(@RequestBody(required = false) Map<String, String> body) {
		String username = body != null ? body.get("username") : null;
		Map<String, Object> options = passkeyService.generateAuthenticationOptions(username);
		return ResponseEntity.ok(options);
	}

	/**
	 * Verify passkey authentication.
	 */
	@PostMapping("/passkey/login-verify")
	@SuppressWarnings("unchecked")
	public ResponseEntity<?> verifyPasskeyLogin(@RequestBody Map<String, Object> body) {
		Map<String, Object> credential = (Map<String, Object>) body.get("credential");

		String username = passkeyService.verifyAuthentication(credential);
		if (username != null) {
			// Generate JWT token for the authenticated user
			String token = authService.generateTokenPublic(username);
			return ResponseEntity.ok(Map.of(
				"token", token,
				"username", username,
				"passkey", true
			));
		} else {
			return ResponseEntity.status(401).body(Map.of("error", "Authentication failed"));
		}
	}

	/**
	 * Check if user has passkey registered.
	 */
	@GetMapping("/passkey/check/{username}")
	public ResponseEntity<?> checkPasskey(@PathVariable String username) {
		boolean hasPasskey = passkeyService.hasPasskey(username);
		return ResponseEntity.ok(Map.of("hasPasskey", hasPasskey));
	}

	// ==================== ACCOUNT MANAGEMENT ====================

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