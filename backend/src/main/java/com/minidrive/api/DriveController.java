package com.minidrive.api;

import com.minidrive.db.DatabaseService;
import com.minidrive.storage.StorageService;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

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

	// Temporary storage for active uploads (Session State)
	private static final Map<String, List<String>> UPLOAD_CHUNKS_MAP = new ConcurrentHashMap<>();
	private static final Map<String, FileInfo> UPLOAD_METADATA_MAP = new ConcurrentHashMap<>();

	// --- 0. GET USER FILES (New for Dashboard) ---
	@GetMapping("/files")
	public ResponseEntity<List<Map<String, Object>>> getUserFiles(Authentication authentication) {
		if (authentication == null) return ResponseEntity.status(401).build();

		String username = authentication.getName();
		List<Map<String, Object>> files = databaseService.getFilesByUser(username);

		return ResponseEntity.ok(files);
	}

	// --- 1. Initiate Upload ---
	@PostMapping("/init")
	public ResponseEntity<String> initUpload(@RequestParam("filename") String filename,
											 @RequestParam("size") long size) {
		String uploadId = UUID.randomUUID().toString();

		// Initialize session
		UPLOAD_CHUNKS_MAP.put(uploadId, new ArrayList<>());
		UPLOAD_METADATA_MAP.put(uploadId, new FileInfo(filename, size));

		System.out.println("REST: Started upload [" + uploadId + "] for " + filename);
		return ResponseEntity.ok(uploadId);
	}

	// --- 2. Upload Chunk ---
	@PostMapping("/upload/chunk")
	public ResponseEntity<String> uploadChunk(@RequestParam("uploadId") String uploadId,
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

			// DEDUPLICATION: Check physical storage
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

	@GetMapping("/download/{filename}")
	public ResponseEntity<StreamingResponseBody> downloadFile(
			@PathVariable String filename,
			Authentication authentication) {

		if (authentication == null) return ResponseEntity.status(401).build();
		String username = authentication.getName();

		// 1. Find the File ID
		Map<String, Object> metadata = databaseService.getFileMetadata(filename, username);
		if (metadata == null) return ResponseEntity.notFound().build();

		String fileId = (String) metadata.get("id");
		Long fileSize = (Long) metadata.get("size");

		// 2. Get the list of chunks
		List<String> chunks = databaseService.getFileChunks(fileId);

		// 3. Create a Stream that pulls chunks one by one
		StreamingResponseBody stream = outputStream -> {
			for (String hash : chunks) {
				byte[] data = storageService.downloadChunk(hash);
				outputStream.write(data); // Send to user immediately
				outputStream.flush();
			}
		};

		return ResponseEntity.ok()
				.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
				.contentLength(fileSize)
				.contentType(MediaType.APPLICATION_OCTET_STREAM)
				.body(stream);
	}



	// --- 3. Finalize ---
	@PostMapping("/complete")
	public ResponseEntity<String> completeUpload(@RequestParam("uploadId") String uploadId) {
		FileInfo info = UPLOAD_METADATA_MAP.get(uploadId);
		List<String> hashes = UPLOAD_CHUNKS_MAP.get(uploadId);

		if (info == null || hashes == null) return ResponseEntity.status(404).body("Session missing");

		// A. Get Current User (from JWT)
		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		String username = (auth != null) ? auth.getName() : "anonymous";

		// B. Save Metadata with OWNER
		String newFileId = UUID.randomUUID().toString();
		// Updated to pass 4 arguments: ID, Name, Size, Username
		databaseService.saveFileMetadata(newFileId, info.name, info.size, username);

		// C. Link Chunks
		for (int i = 0; i < hashes.size(); i++) {
			if (hashes.get(i) == null) return ResponseEntity.status(400).body("Missing chunk #" + i);
			databaseService.addChunkToFile(newFileId, hashes.get(i), i);
		}

		// D. Trigger Background Worker (RabbitMQ)
		if (rabbitTemplate != null) {
			String message = "FILE_ID:" + newFileId + "|NAME:" + info.name;
			try {
				rabbitTemplate.convertAndSend("file-processing-queue", message);
				System.out.println("⚡ REST: Published event to RabbitMQ: " + message);
			} catch (Exception e) {
				System.err.println("⚠️ Warning: RabbitMQ down");
			}
		}

		// Cleanup
		UPLOAD_METADATA_MAP.remove(uploadId);
		UPLOAD_CHUNKS_MAP.remove(uploadId);

		System.out.println("REST: Finalized file " + info.name + " for user " + username);
		return ResponseEntity.ok(newFileId);
	}

	record FileInfo(String name, long size) {}
}