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

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
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

	// === LEGACY (for methods not yet migrated) ===
	@Autowired private DatabaseService databaseService;

	// === SESSION STATE ===
	private static final Map<String, List<String>> UPLOAD_CHUNKS_MAP = new ConcurrentHashMap<>();
	private static final Map<String, FileInfo> UPLOAD_METADATA_MAP = new ConcurrentHashMap<>();

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
		UPLOAD_METADATA_MAP.put(uploadId, new FileInfo(filename, size, folderId != null ? folderId : "root"));
		UPLOAD_CHUNKS_MAP.put(uploadId, new ArrayList<>());

		return ResponseEntity.ok(uploadId);
	}

	@PostMapping("/upload/chunk")
	public ResponseEntity<String> uploadChunk(
			@RequestParam("uploadId") String uploadId,
			@RequestParam("index") int index,
			@RequestParam("hash") String hash,
			@RequestParam("chunk") MultipartFile chunkData) {
		try {
			List<String> chunkList = UPLOAD_CHUNKS_MAP.get(uploadId);
			if (chunkList == null) return ResponseEntity.status(404).body("Session not found");

			synchronized (chunkList) {
				while (chunkList.size() <= index) chunkList.add(null);
				chunkList.set(index, hash);
			}

			if (!storageService.doesChunkExist(hash)) {
				storageService.uploadChunk(hash, chunkData.getBytes());
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
		FileInfo info = UPLOAD_METADATA_MAP.get(uploadId);
		List<String> hashes = UPLOAD_CHUNKS_MAP.get(uploadId);

		if (info == null || hashes == null) return ResponseEntity.status(404).body("Session missing");

		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		String username = (auth != null) ? auth.getName() : "anonymous";
		String newFileId = UUID.randomUUID().toString();

		BaseRepository.DbResult res = fileRepository.saveFileMetadata(newFileId, info.name, info.size, username, info.folderId);
		if (!res.success) return ResponseEntity.status(500).body(res.message);

		for (int i = 0; i < hashes.size(); i++) {
			if (hashes.get(i) == null) return ResponseEntity.status(400).body("Missing chunk #" + i);
			fileRepository.addChunkToFile(newFileId, hashes.get(i), i);
		}

		activityRepository.logActivity(username, "UPLOAD", info.name);

		if (rabbitTemplate != null) {
			try {
				rabbitTemplate.convertAndSend("file-processing-queue", "FILE_ID:" + newFileId + "|NAME:" + info.name);
			} catch (Exception e) { /* RabbitMQ Down */ }
		}

		UPLOAD_METADATA_MAP.remove(uploadId);
		UPLOAD_CHUNKS_MAP.remove(uploadId);
		return ResponseEntity.ok(newFileId);
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

	// ==================== DOWNLOAD ====================

	@GetMapping("/download/folder/{folderId}")
	public ResponseEntity<StreamingResponseBody> downloadFolder(@PathVariable String folderId, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();

		List<Map<String, Object>> filesToZip = databaseService.getFilesRecursive(folderId, auth.getName());

		if (filesToZip.isEmpty()) {
			return ResponseEntity.status(404).body(out -> out.write("Empty folder".getBytes()));
		}

		StreamingResponseBody stream = outputStream -> {
			try (ZipOutputStream zos = new ZipOutputStream(outputStream)) {
				for (Map<String, Object> file : filesToZip) {
					String fileId = (String) file.get("id");
					String zipPath = (String) file.get("zipPath");

					ZipEntry zipEntry = new ZipEntry(zipPath);
					zos.putNextEntry(zipEntry);

					List<String> chunks = fileRepository.getFileChunks(fileId);
					for (String chunkHash : chunks) {
						byte[] chunkData = storageService.downloadChunk(chunkHash);
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

		StreamingResponseBody stream = outputStream -> {
			for (String hash : chunks) {
				outputStream.write(storageService.downloadChunk(hash));
				outputStream.flush();
			}
		};

		return ResponseEntity.ok()
				.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
				.contentLength(fileSize)
				.contentType(MediaType.APPLICATION_OCTET_STREAM)
				.body(stream);
	}

	record FileInfo(String name, long size, String folderId) {}
}