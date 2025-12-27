package com.minidrive.api;

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

	// Session State (Tracks active uploads in memory)
	private static final Map<String, List<String>> UPLOAD_CHUNKS_MAP = new ConcurrentHashMap<>();
	private static final Map<String, FileInfo> UPLOAD_METADATA_MAP = new ConcurrentHashMap<>();

	// --- 1. UNIFIED CONTENT API (Files + Folders + Filters) ---
	// This matches what Dashboard.js calls
	@GetMapping("/content")
	public ResponseEntity<?> getContent(
			@RequestParam(required = false) String folderId,
			@RequestParam(required = false) String filter, // 'trash', 'starred', 'recent'
			Authentication auth) {

		if (auth == null) return ResponseEntity.status(401).build();

		// Frontend sends "root" string, DB expects null for root
		String dbFolderId = "root".equals(folderId) ? null : folderId;

		return ResponseEntity.ok(databaseService.getFilesByFilter(filter, dbFolderId, auth.getName()));
	}

	// --- 2. CREATE FOLDER ---
	@PostMapping("/folders")
	public ResponseEntity<?> createFolder(@RequestBody Map<String, String> body, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();

		String name = body.get("name");
		String parentId = body.get("parentId");

		databaseService.createFolder(name, parentId, auth.getName());
		return ResponseEntity.ok().build();
	}

	// --- 3. ACTIONS (Trash & Star) ---
	@PostMapping("/action/trash")
	public ResponseEntity<?> trashItem(@RequestBody Map<String, Object> body, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		String id = (String) body.get("id");
		String type = (String) body.get("type"); // 'file' or 'folder'
		boolean trash = (Boolean) body.get("value");

		databaseService.toggleTrash(id, "folder".equals(type), trash);
		return ResponseEntity.ok().build();
	}

	@PostMapping("/action/star")
	public ResponseEntity<?> starItem(@RequestBody Map<String, Object> body, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();
		String id = (String) body.get("id");
		String type = (String) body.get("type");
		boolean star = (Boolean) body.get("value");

		databaseService.toggleStar(id, "folder".equals(type), star);
		return ResponseEntity.ok().build();
	}

	// --- 4. INITIATE UPLOAD ---
	@PostMapping("/init")
	public ResponseEntity<String> initUpload(
			@RequestParam("filename") String filename,
			@RequestParam("size") long size,
			@RequestParam(value = "folderId", required = false) String folderId) {

		String uploadId = UUID.randomUUID().toString();

		// Initialize session state
		UPLOAD_CHUNKS_MAP.put(uploadId, new ArrayList<>());
		UPLOAD_METADATA_MAP.put(uploadId, new FileInfo(filename, size, folderId));

		System.out.println("REST: Started upload [" + uploadId + "] for " + filename);
		return ResponseEntity.ok(uploadId);
	}

	// --- 5. UPLOAD CHUNK ---
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
				System.out.println("REST: Uploaded chunk #" + index);
			} else {
				System.out.println("REST: Deduped chunk #" + index);
			}

			return ResponseEntity.ok("Received");

		} catch (IOException e) {
			return ResponseEntity.status(500).body("Error processing chunk");
		}
	}

	// --- 6. COMPLETE UPLOAD ---
	@PostMapping("/complete")
	public ResponseEntity<String> completeUpload(@RequestParam("uploadId") String uploadId) {
		FileInfo info = UPLOAD_METADATA_MAP.get(uploadId);
		List<String> hashes = UPLOAD_CHUNKS_MAP.get(uploadId);

		if (info == null || hashes == null) return ResponseEntity.status(404).body("Session missing");

		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		String username = (auth != null) ? auth.getName() : "anonymous";

		String newFileId = UUID.randomUUID().toString();

		// SAVE METADATA (Now with folderId)
		databaseService.saveFileMetadata(newFileId, info.name, info.size, username, info.folderId);

		// LINK CHUNKS
		for (int i = 0; i < hashes.size(); i++) {
			if (hashes.get(i) == null) return ResponseEntity.status(400).body("Missing chunk #" + i);
			databaseService.addChunkToFile(newFileId, hashes.get(i), i);
		}

		// RABBITMQ EVENT
		if (rabbitTemplate != null) {
			String message = "FILE_ID:" + newFileId + "|NAME:" + info.name;
			try {
				rabbitTemplate.convertAndSend("file-processing-queue", message);
				System.out.println("⚡ REST: Published event to RabbitMQ: " + message);
			} catch (Exception e) {
				System.err.println("⚠️ Warning: RabbitMQ down");
			}
		}

		// CLEANUP
		UPLOAD_METADATA_MAP.remove(uploadId);
		UPLOAD_CHUNKS_MAP.remove(uploadId);

		System.out.println("REST: Finalized file " + info.name);
		return ResponseEntity.ok(newFileId);
	}

	// --- 7. DELETE FILE ---
	@DeleteMapping("/{id}")
	public ResponseEntity<?> deleteFile(@PathVariable String id, Authentication authentication) {
		if (authentication == null) return ResponseEntity.status(401).build();
		// Since we are using "Trash" logic now, this endpoint handles permanent deletion
		// OR the frontend calls trash action instead.
		// For simple compatibility, let's map DELETE verb to "Move to Trash" if not already there
		databaseService.toggleTrash(id, false, true); // Assuming it's a file for now
		return ResponseEntity.ok().build();
	}


	// CHANGE URL: Add "/permanent" suffix
	@DeleteMapping("/{id}/permanent")
	public ResponseEntity<?> deletePermanently(@PathVariable String id, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();

		databaseService.deleteEntityById(id, auth.getName());
		return ResponseEntity.ok().build();
	}

	// Move Item
	@PostMapping("/action/move")
	public ResponseEntity<?> moveItem(@RequestBody Map<String, Object> body, Authentication auth) {
		if (auth == null) return ResponseEntity.status(401).build();

		String id = (String) body.get("id");
		String type = (String) body.get("type"); // 'file' or 'folder'
		String targetId = (String) body.get("targetId"); // ID or null (for root)

		databaseService.moveEntity(id, "folder".equals(type), targetId, auth.getName());
		return ResponseEntity.ok().build();
	}

	// --- 8. DOWNLOAD FILE ---
	@GetMapping("/download/{filename}")
	public ResponseEntity<StreamingResponseBody> downloadFile(
			@PathVariable String filename,
			Authentication authentication) {

		if (authentication == null) return ResponseEntity.status(401).build();
		String username = authentication.getName();

		Map<String, Object> metadata = databaseService.getFileMetadata(filename, username);
		if (metadata == null) return ResponseEntity.notFound().build();

		String fileId = (String) metadata.get("id");
		Long fileSize = (Long) metadata.get("size");
		List<String> chunks = databaseService.getFileChunks(fileId);

		StreamingResponseBody stream = outputStream -> {
			for (String hash : chunks) {
				byte[] data = storageService.downloadChunk(hash);
				outputStream.write(data);
				outputStream.flush();
			}
		};

		return ResponseEntity.ok()
				.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
				.contentLength(fileSize)
				.contentType(MediaType.APPLICATION_OCTET_STREAM)
				.body(stream);
	}

	// Internal Record
	record FileInfo(String name, long size, String folderId) {}
}