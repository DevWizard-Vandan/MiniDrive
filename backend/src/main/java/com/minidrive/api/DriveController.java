package com.minidrive.api;

import com.minidrive.auth.AuthService;
import com.minidrive.db.DatabaseService;
import com.minidrive.storage.StorageService;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@CrossOrigin(origins = "http://localhost:3000")
@RequestMapping("/api/drive")
public class DriveController {

	@Autowired
	private StorageService storageService;

	@Autowired
	private DatabaseService databaseService;

	@Autowired
	private RabbitTemplate rabbitTemplate;

	@Autowired
	private AuthService authService;

	// Session State (In-Memory)
	private static final Map<String, List<String>> UPLOAD_CHUNKS_MAP = new ConcurrentHashMap<>();
	private static final Map<String, FileInfo> UPLOAD_METADATA_MAP = new ConcurrentHashMap<>();

	// --- 1. CONTENT API ---
	@GetMapping("/content")
	public ResponseEntity<?> getContent(
			@RequestParam(required = false) String folderId,
			@RequestParam(required = false) String filter,
			Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		String dbFolderId = "root".equals(folderId) ? null : folderId;
		return ResponseEntity.ok(databaseService.getFilesByFilter(filter, dbFolderId, auth.getName()));
	}

	// --- 2. FOLDERS ---
	@PostMapping("/folders")
	public ResponseEntity<?> createFolder(@RequestBody Map<String, String> body, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		databaseService.createFolder(body.get("name"), body.get("parentId"), auth.getName());
		return ResponseEntity.ok().build();
	}

	// --- 3. ACTIONS ---
	@PostMapping("/action/trash")
	public ResponseEntity<?> trashItem(@RequestBody Map<String, Object> body, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		databaseService.toggleTrash((String) body.get("id"), "folder".equals(body.get("type")), (Boolean) body.get("value"));
		return ResponseEntity.ok().build();
	}

	@PostMapping("/action/star")
	public ResponseEntity<?> starItem(@RequestBody Map<String, Object> body, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		databaseService.toggleStar((String) body.get("id"), "folder".equals(body.get("type")), (Boolean) body.get("value"));
		return ResponseEntity.ok().build();
	}

	@PostMapping("/action/move")
	public ResponseEntity<?> moveItem(@RequestBody Map<String, Object> body, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		databaseService.moveEntity((String) body.get("id"), "folder".equals(body.get("type")), (String) body.get("targetId"), auth.getName());
		return ResponseEntity.ok().build();
	}

	// --- 4. UPLOAD FLOW ---
	@PostMapping("/init")
	public ResponseEntity<?> initUpload(@RequestParam("filename") String filename,
										@RequestParam("size") long size,
										@RequestParam(value = "folderId", required = false) String folderId,
										Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		String username = auth.getName();

		// 1. Check Quota (Your Custom Logic)
		Map<String, Long> stats = databaseService.getUserStats(username);
		long currentFiles = stats.get("count");
		long currentUsed = stats.get("used");

		long LIMIT_1_FILE = 1024L * 1024 * 1024 * 1024; // 1 TB
		long LIMIT_MULTI = 5L * 1024 * 1024 * 1024;     // 5 GB

		if (currentFiles == 0) {
			if (size > LIMIT_1_FILE) return ResponseEntity.status(400).body("File too large. Single file limit is 1TB.");
		} else {
			if ((currentUsed + size) > LIMIT_MULTI) return ResponseEntity.status(400).body("Storage Quota Exceeded. Multi-file limit is 5GB.");
		}

		// 2. Initialize Session
		String uploadId = UUID.randomUUID().toString();

		// FIX: Store metadata in the static maps so chunks can find it
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
			}
			return ResponseEntity.ok("Received");
		} catch (IOException e) {
			return ResponseEntity.status(500).body("Error processing chunk");
		}
	}

	@PostMapping("/complete")
	public ResponseEntity<String> completeUpload(@RequestParam("uploadId") String uploadId) {
		FileInfo info = UPLOAD_METADATA_MAP.get(uploadId);
		List<String> hashes = UPLOAD_CHUNKS_MAP.get(uploadId);

		if (info == null || hashes == null) return ResponseEntity.status(404).body("Session missing");

		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		String username = (auth != null) ? auth.getName() : "anonymous";
		String newFileId = UUID.randomUUID().toString();

		databaseService.saveFileMetadata(newFileId, info.name, info.size, username, info.folderId);

		for (int i = 0; i < hashes.size(); i++) {
			if (hashes.get(i) == null) return ResponseEntity.status(400).body("Missing chunk #" + i);
			databaseService.addChunkToFile(newFileId, hashes.get(i), i);
		}

		if (rabbitTemplate != null) {
			try {
				rabbitTemplate.convertAndSend("file-processing-queue", "FILE_ID:" + newFileId + "|NAME:" + info.name);
			} catch (Exception e) { /* RabbitMQ Down */ }
		}

		UPLOAD_METADATA_MAP.remove(uploadId);
		UPLOAD_CHUNKS_MAP.remove(uploadId);
		return ResponseEntity.ok(newFileId);
	}

	// --- 5. DELETION ---
	@DeleteMapping("/{id}")
	public ResponseEntity<?> deleteFile(@PathVariable String id, Authentication authentication) {
		if (authentication == null) return ResponseEntity.status(401).build();
		// Default to soft delete (Trash)
		databaseService.toggleTrash(id, false, true);
		return ResponseEntity.ok().build();
	}

	@DeleteMapping("/{id}/permanent")
	public ResponseEntity<?> deletePermanently(@PathVariable String id, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		databaseService.deleteEntityById(id, auth.getName());
		return ResponseEntity.ok().build();
	}

	// --- 6. SEARCH & STATS ---
	@GetMapping("/search")
	public ResponseEntity<List<Map<String, Object>>> search(@RequestParam String query, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		return ResponseEntity.ok(databaseService.searchFiles(query, auth.getName()));
	}

	@GetMapping("/stats")
	public ResponseEntity<Map<String, Long>> getStats(Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		return ResponseEntity.ok(databaseService.getUserStats(auth.getName()));
	}

	// --- 7. VIEW & SHARE & DOWNLOAD ---
	@GetMapping("/view/{filename}")
	public ResponseEntity<StreamingResponseBody> viewFile(
			@PathVariable String filename,
			@RequestParam(required = false) String token,
			Authentication authentication) {

		String username = null;
		if (authentication != null) {
			username = authentication.getName();
		} else if (token != null) {
			username = authService.validateTokenAndGetUsername(token);
		}

		if (username == null) return ResponseEntity.status(401).build();

		Map<String, Object> metadata = databaseService.getFileMetadata(filename, username);
		if (metadata == null) return ResponseEntity.notFound().build();

		String fileId = (String) metadata.get("id");
		Long fileSize = (Long) metadata.get("size");

		String contentType = "application/octet-stream";
		String lower = filename.toLowerCase();
		if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) contentType = "image/jpeg";
		else if (lower.endsWith(".png")) contentType = "image/png";
		else if (lower.endsWith(".mp4")) contentType = "video/mp4";
		else if (lower.endsWith(".pdf")) contentType = "application/pdf";
		else if (lower.endsWith(".txt")) contentType = "text/plain";

		List<String> chunks = databaseService.getFileChunks(fileId);
		StreamingResponseBody stream = outputStream -> {
			for (String hash : chunks) {
				outputStream.write(storageService.downloadChunk(hash));
				outputStream.flush();
			}
		};

		return ResponseEntity.ok()
				.header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
				.contentLength(fileSize)
				.contentType(MediaType.parseMediaType(contentType))
				.body(stream);
	}

	@PostMapping("/share/{fileId}")
	public ResponseEntity<String> shareFile(@PathVariable String fileId, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		String token = databaseService.createShareLink(fileId, auth.getName());
		return ResponseEntity.ok(token);
	}

	@GetMapping("/download/{filename}")
	public ResponseEntity<StreamingResponseBody> downloadFile(
			@PathVariable String filename,
			Authentication authentication) {

		if (authentication == null) return ResponseEntity.status(401).build();

		Map<String, Object> metadata = databaseService.getFileMetadata(filename, authentication.getName());
		if (metadata == null) return ResponseEntity.notFound().build();

		String fileId = (String) metadata.get("id");
		Long fileSize = (Long) metadata.get("size");
		List<String> chunks = databaseService.getFileChunks(fileId);

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