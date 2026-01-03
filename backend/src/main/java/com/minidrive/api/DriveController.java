package com.minidrive.api;

import com.minidrive.auth.AuthService;
import com.minidrive.db.DatabaseService;
import com.minidrive.repository.*;
import com.minidrive.storage.StorageService;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import com.minidrive.service.EncryptionService;
import com.minidrive.service.UploadStateService;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@RestController
@CrossOrigin(origins = "http://localhost:3000")
@RequestMapping("/api/drive")
public class DriveController {

	// === SERVICES ===
	@Autowired private StorageService storageService;
	@Autowired private AuthService authService;
	@Autowired(required = false) private RabbitTemplate rabbitTemplate;

	// === REPOSITORIES ===
	@Autowired private FileRepository fileRepository;
	@Autowired private FolderRepository folderRepository;
	@Autowired private ActivityRepository activityRepository;
	@Autowired private ShareRepository shareRepository;
	@Autowired private com.minidrive.repository.FileVersionRepository fileVersionRepository;

	// === LEGACY (for methods not yet migrated) ===
	@Autowired private DatabaseService databaseService;

	// === REDIS-BACKED UPLOAD STATE (enables horizontal scaling) ===
	@Autowired private UploadStateService uploadStateService;

	// === ENCRYPTION (Zero-Knowledge Architecture) ===
	@Autowired private EncryptionService encryptionService;

	// === WEBSOCKET EVENT PUBLISHING (Real-Time Sync) ===
	@Autowired private com.minidrive.service.DriveEventPublisher driveEventPublisher;

	// === DELTA SYNC (Rsync-style binary diff) ===
	@Autowired private com.minidrive.service.DeltaSyncService deltaSyncService;

	// === GLOBAL DEDUPLICATION (Zero-Knowledge) ===
	@Autowired private com.minidrive.service.DeduplicationService deduplicationService;

	// ==================== VIEW CONTENT ====================

	@GetMapping("/content")
	public ResponseEntity<?> getContent(
			@RequestParam(required = false) String folderId,
			@RequestParam(required = false) String filter,
			Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		String dbFolderId = "root".equals(folderId) ? null : folderId;
		return ResponseEntity.ok(folderRepository.getFilesByFilter(filter, dbFolderId, auth.getName()));
	}

	// ==================== FOLDER OPERATIONS ====================

	@PostMapping("/folders")
	@Transactional
	public ResponseEntity<?> createFolder(@RequestBody Map<String, String> body, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();

		BaseRepository.DbResult result = folderRepository.createFolder(
				body.get("name"),
				body.get("parentId"),
				auth.getName()
		);

		if (result.success) {
			activityRepository.logActivity(auth.getName(), "CREATE_FOLDER", body.get("name"));
			driveEventPublisher.publishFolderCreated(auth.getName(), null, body.get("name"), body.get("parentId"));
			return ResponseEntity.ok().build();
		} else {
			return ResponseEntity.badRequest().body(result.message);
		}
	}

	// ==================== ITEM ACTIONS ====================

	@PostMapping("/action/trash")
	@Transactional
	public ResponseEntity<?> trashItem(@RequestBody Map<String, Object> body, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();

		String id = (String) body.get("id");
		boolean isFolder = "folder".equals(body.get("type"));
		boolean isTrashAction = (Boolean) body.get("value");

		// Still using databaseService for complex trash operations
		DatabaseService.DbResult result;
		if (!isTrashAction && isFolder) {
			result = databaseService.restoreFolderWithContents(id, auth.getName());
		} else {
			result = databaseService.toggleTrash(id, isFolder, isTrashAction, auth.getName());
		}

		if (result.success) {
			activityRepository.logActivity(auth.getName(), isTrashAction ? "TRASH" : "RESTORE", "Item " + id);
			if (isTrashAction) {
				driveEventPublisher.publishFileDeleted(auth.getName(), id, "Item", false);
			} else {
				driveEventPublisher.publishFileRestored(auth.getName(), id, "Item");
			}
			return ResponseEntity.ok(Map.of("message", result.message));
		} else {
			return ResponseEntity.badRequest().body(Map.of("error", result.message));
		}
	}

	@PostMapping("/action/star")
	@Transactional
	public ResponseEntity<?> starItem(@RequestBody Map<String, Object> body, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();

		DatabaseService.DbResult result = databaseService.toggleStar(
				(String) body.get("id"),
				"folder".equals(body.get("type")),
				(Boolean) body.get("value"),
				auth.getName()
		);

		if (result.success) {
			driveEventPublisher.publishStarChanged(auth.getName(), (String) body.get("id"), (String) body.get("type"), (Boolean) body.get("value"));
		}
		return result.success ? ResponseEntity.ok().build() : ResponseEntity.badRequest().body(result.message);
	}

	@PostMapping("/action/move")
	@Transactional
	public ResponseEntity<?> moveItem(@RequestBody Map<String, Object> body, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();

		DatabaseService.DbResult result = databaseService.moveEntity(
				(String) body.get("id"),
				"folder".equals(body.get("type")),
				(String) body.get("targetId"),
				auth.getName()
		);

		return result.success ? ResponseEntity.ok().build() : ResponseEntity.badRequest().body(result.message);
	}

	// ==================== UPLOAD FLOW ====================

	@PostMapping("/init")
	public ResponseEntity<?> initUpload(
			@RequestParam("filename") String filename,
			@RequestParam("size") long size,
			@RequestParam(value = "folderId", required = false) String folderId,
			Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();

		// Quota Check
		Map<String, Long> stats = databaseService.getUserStats(auth.getName());
		long used = stats.getOrDefault("used", 0L);
		if ((used + size) > (5L * 1024 * 1024 * 1024)) {
			return ResponseEntity.status(400).body("Quota Exceeded");
		}

		String uploadId = UUID.randomUUID().toString();
		uploadStateService.initSession(uploadId, filename, size, 
				folderId != null ? folderId : "root", auth.getName());

		return ResponseEntity.ok(uploadId);
	}

	@PostMapping("/upload/chunk")
	public ResponseEntity<String> uploadChunk(
			@RequestParam("uploadId") String uploadId,
			@RequestParam("index") int index,
			@RequestParam("hash") String hash,
			@RequestParam("chunk") MultipartFile chunkData) {
		try {
			UploadStateService.UploadMetadata meta = uploadStateService.getMetadata(uploadId);
			if (meta == null) {
				return ResponseEntity.status(404).body("Session not found");
			}

			// Register chunk in Redis
			uploadStateService.registerChunk(uploadId, index, hash);

			// Get user's encryption key
			SecretKey userKey = getUserEncryptionKey(meta.username());

			// Upload to MinIO with encryption (Zero-Knowledge)
			if (!storageService.doesChunkExist(hash)) {
				if (userKey != null) {
					// Encrypted upload (new users with keys)
					storageService.uploadChunkEncrypted(hash, chunkData.getBytes(), userKey);
				} else {
					// Fallback: unencrypted for legacy users without keys
					storageService.uploadChunk(hash, chunkData.getBytes());
				}
			} else {
				fileRepository.registerGlobalChunk(hash);
			}
			return ResponseEntity.ok("Received");
		} catch (IOException e) {
			return ResponseEntity.status(500).body("Error processing chunk");
		}
	}

	@PostMapping("/complete")
	@Transactional
	public ResponseEntity<String> completeUpload(@RequestParam("uploadId") String uploadId) {
		UploadStateService.UploadMetadata info = uploadStateService.getMetadata(uploadId);
		List<String> hashes = uploadStateService.getChunkHashes(uploadId);

		if (info == null || hashes == null) return ResponseEntity.status(404).body("Session missing");

		String username = info.username();
		String newFileId = UUID.randomUUID().toString();

		BaseRepository.DbResult res = fileRepository.saveFileMetadata(newFileId, info.filename(), info.size(), username, info.folderId());
		if (!res.success) return ResponseEntity.status(500).body(res.message);

		for (int i = 0; i < hashes.size(); i++) {
			if (hashes.get(i) == null) return ResponseEntity.status(400).body("Missing chunk #" + i);
			fileRepository.addChunkToFile(newFileId, hashes.get(i), i);
		}

		activityRepository.logActivity(username, "UPLOAD", info.filename());

		if (rabbitTemplate != null) {
			try {
				rabbitTemplate.convertAndSend("file-processing-queue", "FILE_ID:" + newFileId + "|NAME:" + info.filename());
			} catch (Exception e) { /* RabbitMQ Down */ }
		}

		uploadStateService.cleanupSession(uploadId);

		// Publish real-time event
		driveEventPublisher.publishFileUploaded(username, newFileId, info.filename(), info.size(), info.folderId());

		return ResponseEntity.ok(newFileId);
	}

	// ==================== DELTA SYNC (Rsync-style) ====================

	/**
	 * Get file signature for delta sync.
	 * Returns block hashes for the client to compare against.
	 */
	@GetMapping("/signature/{fileId}")
	public ResponseEntity<?> getFileSignature(@PathVariable String fileId, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();

		// Verify ownership
		Map<String, Object> file = fileRepository.getFileMetadataById(fileId, auth.getName());
		if (file == null) return ResponseEntity.status(404).build();

		SecretKey userKey = getUserEncryptionKey(auth.getName());
		Map<String, Object> signature = deltaSyncService.computeSignature(fileId, auth.getName(), userKey);

		if (signature == null) {
			return ResponseEntity.status(404).body("Cannot compute signature");
		}

		return ResponseEntity.ok(signature);
	}

	/**
	 * Apply delta upload - reconstruct file from delta patch.
	 */
	@PostMapping("/delta-upload")
	@Transactional
	public ResponseEntity<?> deltaUpload(
			@RequestParam("fileId") String fileId,
			@RequestParam("instructions") String instructionsJson,
			@RequestParam("filename") String filename,
			@RequestParam("totalSize") long totalSize,
			@RequestParam Map<String, org.springframework.web.multipart.MultipartFile> allFiles,
			Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();

		try {
			// Parse instructions
			com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
			@SuppressWarnings("unchecked")
			List<Map<String, Object>> instructions = mapper.readValue(instructionsJson, List.class);

			// Extract new blocks from multipart
			Map<Integer, byte[]> newBlocks = new HashMap<>();
			for (Map.Entry<String, org.springframework.web.multipart.MultipartFile> entry : allFiles.entrySet()) {
				if (entry.getKey().startsWith("block_")) {
					int blockIndex = Integer.parseInt(entry.getKey().replace("block_", ""));
					newBlocks.put(blockIndex, entry.getValue().getBytes());
				}
			}

			// Apply delta
			SecretKey userKey = getUserEncryptionKey(auth.getName());
			byte[] reconstructed = deltaSyncService.applyDelta(fileId, instructions, newBlocks, auth.getName(), userKey);

			// Save as new version (same fileId, new content)
			String newFileId = UUID.randomUUID().toString();
			// Upload reconstructed file as chunks
			int chunkSize = 1024 * 1024;
			for (int i = 0; i < reconstructed.length; i += chunkSize) {
				int end = Math.min(i + chunkSize, reconstructed.length);
				byte[] chunk = java.util.Arrays.copyOfRange(reconstructed, i, end);
				String hash = computeChunkHash(chunk);
				
				if (!storageService.doesChunkExist(hash)) {
					if (userKey != null) {
						storageService.uploadChunkEncrypted(hash, chunk, userKey);
					} else {
						storageService.uploadChunk(hash, chunk);
					}
				}
				fileRepository.registerGlobalChunk(hash);
			}

			// Record in DB
			BaseRepository.DbResult res = fileRepository.saveFileMetadata(newFileId, filename, reconstructed.length, auth.getName(), null);
			if (!res.success) return ResponseEntity.status(500).body("Failed to save file");

			activityRepository.logActivity(auth.getName(), "DELTA_UPLOAD", filename);
			driveEventPublisher.publishFileUploaded(auth.getName(), newFileId, filename, reconstructed.length, null);

			return ResponseEntity.ok(Map.of(
				"fileId", newFileId,
				"size", reconstructed.length,
				"deltaUpload", true
			));

		} catch (Exception e) {
			return ResponseEntity.status(500).body("Delta upload failed: " + e.getMessage());
		}
	}

	private String computeChunkHash(byte[] chunk) {
		try {
			java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
			byte[] hash = md.digest(chunk);
			StringBuilder sb = new StringBuilder();
			for (byte b : hash) sb.append(String.format("%02x", b));
			return sb.toString();
		} catch (Exception e) {
			return UUID.randomUUID().toString();
		}
	}

	// ==================== PERMANENT DELETE ====================

	@DeleteMapping("/{id}/permanent")
	@Transactional
	public ResponseEntity<?> deletePermanently(@PathVariable String id, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();

		DatabaseService.DbResult result = databaseService.deleteEntityById(id, auth.getName());

		if (result.success) {
			activityRepository.logActivity(auth.getName(), "DELETE_FOREVER", "ID: " + id);
			return ResponseEntity.ok().build();
		} else {
			return ResponseEntity.badRequest().body(result.message);
		}
	}

	// ==================== SHARE ====================

	@PostMapping("/share/{fileId}")
	@Transactional
	public ResponseEntity<?> createShareLink(@PathVariable String fileId, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();

		String token = shareRepository.createShareLink(fileId, auth.getName());
		if (token != null) {
			String shareUrl = "http://localhost:3000/share/" + token;
			activityRepository.logActivity(auth.getName(), "SHARE", "File ID: " + fileId);
			return ResponseEntity.ok(Map.of("token", token, "url", shareUrl));
		} else {
			return ResponseEntity.badRequest().body(Map.of("error", "Failed to create share link"));
		}
	}

	@DeleteMapping("/share/{fileId}")
	@Transactional
	public ResponseEntity<?> revokeShareLink(@PathVariable String fileId, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();

		String result = shareRepository.revokeShareLink(fileId, auth.getName());
		if (result != null && result.contains("revoked")) {
			return ResponseEntity.ok(Map.of("message", result));
		} else {
			return ResponseEntity.badRequest().body(Map.of("error", result));
		}
	}

	// ==================== SEARCH & STATS ====================

	@GetMapping("/search")
	public ResponseEntity<List<Map<String, Object>>> search(@RequestParam String query, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		return ResponseEntity.ok(fileRepository.searchFiles(query, auth.getName()));
	}

	@GetMapping("/stats")
	public ResponseEntity<Map<String, Long>> getStats(Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		return ResponseEntity.ok(databaseService.getUserStats(auth.getName()));
	}

	@GetMapping("/activity")
	public ResponseEntity<List<Map<String, Object>>> getActivity(Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		return ResponseEntity.ok(activityRepository.getActivities(auth.getName()));
	}

	// ==================== FILE VERSIONING ====================

	/**
	 * Get all versions of a file.
	 */
	@GetMapping("/versions/{fileId}")
	public ResponseEntity<List<Map<String, Object>>> getFileVersions(@PathVariable String fileId, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		
		// Verify file ownership
		Map<String, Object> file = fileRepository.getFileMetadataById(fileId, auth.getName());
		if (file == null) return ResponseEntity.status(404).build();
		
		List<Map<String, Object>> versions = fileVersionRepository.getVersions(fileId);
		return ResponseEntity.ok(versions);
	}

	/**
	 * Download a specific version of a file.
	 */
	@GetMapping("/download/{fileId}/version/{versionNumber}")
	public ResponseEntity<byte[]> downloadFileVersion(
			@PathVariable String fileId,
			@PathVariable int versionNumber,
			Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		
		// Verify file ownership
		Map<String, Object> file = fileRepository.getFileMetadataById(fileId, auth.getName());
		if (file == null) return ResponseEntity.status(404).build();
		
		String minioVersionId = fileVersionRepository.getMinioVersionId(fileId, versionNumber);
		if (minioVersionId == null) return ResponseEntity.status(404).build();
		
		String objectKey = auth.getName() + "/" + file.get("name");
		byte[] content = storageService.downloadVersionedFile(objectKey, minioVersionId);
		
		if (content.length == 0) return ResponseEntity.status(404).build();
		
		return ResponseEntity.ok()
			.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"v" + versionNumber + "_" + file.get("name") + "\"")
			.contentType(MediaType.APPLICATION_OCTET_STREAM)
			.body(content);
	}

	// ==================== DOWNLOAD ====================

	@GetMapping("/download/folder/{folderId}")
	public ResponseEntity<StreamingResponseBody> downloadFolder(@PathVariable String folderId, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();

		List<Map<String, Object>> filesToZip = databaseService.getFilesRecursive(folderId, auth.getName());

		if (filesToZip.isEmpty()) {
			return ResponseEntity.status(404).body(out -> out.write("Empty folder".getBytes()));
		}

		// Get user's encryption key for decryption
		String username = auth.getName();
		SecretKey userKey = getUserEncryptionKey(username);

		StreamingResponseBody stream = outputStream -> {
			try (ZipOutputStream zos = new ZipOutputStream(outputStream)) {
				for (Map<String, Object> file : filesToZip) {
					String fileId = (String) file.get("id");
					String zipPath = (String) file.get("zipPath");

					ZipEntry zipEntry = new ZipEntry(zipPath);
					zos.putNextEntry(zipEntry);

					List<String> chunks = fileRepository.getFileChunks(fileId);
					for (String chunkHash : chunks) {
						byte[] chunkData;
						if (userKey != null) {
							try {
								chunkData = storageService.downloadChunkEncrypted(chunkHash, userKey);
							} catch (Exception e) {
								// Fallback: try unencrypted (legacy data)
								chunkData = storageService.downloadChunk(chunkHash);
							}
						} else {
							chunkData = storageService.downloadChunk(chunkHash);
						}
						zos.write(chunkData);
					}
					zos.closeEntry();
				}
				zos.finish();
			}
		};

		return ResponseEntity.ok()
				.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"archive.zip\"")
				.contentType(MediaType.parseMediaType("application/zip"))
				.body(stream);
	}

	@GetMapping("/download/{filename}")
	public ResponseEntity<StreamingResponseBody> downloadFile(@PathVariable String filename, Authentication authentication) {
		if (authentication == null) return ResponseEntity.status(401).build();

		Map<String, Object> metadata = fileRepository.getFileMetadata(filename, authentication.getName());
		if (metadata == null) return ResponseEntity.notFound().build();

		String fileId = (String) metadata.get("id");
		Long fileSize = (Long) metadata.get("size");
		List<String> chunks = fileRepository.getFileChunks(fileId);
		String username = authentication.getName();

		// Get user's encryption key for decryption
		SecretKey userKey = getUserEncryptionKey(username);

		StreamingResponseBody stream = outputStream -> {
			for (String hash : chunks) {
				byte[] chunkData;
				if (userKey != null) {
					// Decrypt chunk (Zero-Knowledge)
					try {
						chunkData = storageService.downloadChunkEncrypted(hash, userKey);
					} catch (Exception e) {
						// Fallback: try unencrypted (legacy data)
						chunkData = storageService.downloadChunk(hash);
					}
				} else {
					chunkData = storageService.downloadChunk(hash);
				}
				outputStream.write(chunkData);
				outputStream.flush();
			}
		};

		return ResponseEntity.ok()
				.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
				.contentLength(fileSize)
				.contentType(MediaType.APPLICATION_OCTET_STREAM)
				.body(stream);
	}

	// FileInfo record moved to UploadStateService.UploadMetadata

	// ==================== ENCRYPTION HELPER ====================

	/**
	 * Get user's decrypted encryption key for Zero-Knowledge operations.
	 * Returns null for legacy users without encryption keys.
	 */
	private SecretKey getUserEncryptionKey(String username) {
		try {
			String encryptedKey = authService.getUserEncryptionKey(username);
			if (encryptedKey != null && !encryptedKey.isEmpty()) {
				return encryptionService.decryptUserKey(encryptedKey);
			}
		} catch (Exception e) {
			// Log but don't fail - fall back to unencrypted
		}
		return null;
	}
}