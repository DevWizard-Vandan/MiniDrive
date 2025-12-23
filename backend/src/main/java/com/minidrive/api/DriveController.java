package com.minidrive.api;

import com.minidrive.db.DatabaseService;
import com.minidrive.storage.StorageService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@CrossOrigin(origins = "http://localhost:3000") // Allow React (running on port 3000)
@RequestMapping("/api/drive")
public class DriveController {

	private final StorageService storageService;
	private final DatabaseService databaseService;

	// Temporary storage for active uploads (just like in the gRPC service)
	// Map<UploadId, List<ChunkHash>>
	private static final Map<String, List<String>> UPLOAD_CHUNKS_MAP = new ConcurrentHashMap<>();
	// Map<UploadId, FileMetadata>
	private static final Map<String, FileInfo> UPLOAD_METADATA_MAP = new ConcurrentHashMap<>();

	public DriveController() {
		// In a real Spring app, these would be @Autowired
		this.storageService = new StorageService();
		this.databaseService = new DatabaseService();
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
			// Track the order of hashes for final reconstruction
			List<String> chunkList = UPLOAD_CHUNKS_MAP.get(uploadId);
			if (chunkList == null) return ResponseEntity.status(404).body("Session not found");

			// synchronized to ensure order if multiple chunks arrive at once
			synchronized (chunkList) {
				// Ensure list is big enough (fill gaps if chunks arrive out of order)
				while (chunkList.size() <= index) chunkList.add(null);
				chunkList.set(index, hash);
			}

			// DEDUPLICATION: Check if we already have this chunk physically
			if (!storageService.doesChunkExist(hash)) {
				storageService.uploadChunk(hash, chunkData.getBytes());
				// Also update DB global cache
				// databaseService.addChunkToGlobalCache(hash); // Optional optimization
				System.out.println("REST: Uploaded chunk #" + index);
			} else {
				System.out.println("REST: Deduped chunk #" + index);
			}

			return ResponseEntity.ok("Received");

		} catch (IOException e) {
			return ResponseEntity.status(500).body("Error processing chunk");
		}
	}

	// --- 3. Finalize ---
	@PostMapping("/complete")
	public ResponseEntity<String> completeUpload(@RequestParam("uploadId") String uploadId) {
		FileInfo info = UPLOAD_METADATA_MAP.get(uploadId);
		List<String> hashes = UPLOAD_CHUNKS_MAP.get(uploadId);

		if (info == null || hashes == null) return ResponseEntity.status(404).body("Session missing");

		// Save to PostgreSQL
		String newFileId = UUID.randomUUID().toString();
		databaseService.saveFileMetadata(newFileId, info.name, info.size);

		for (int i = 0; i < hashes.size(); i++) {
			if (hashes.get(i) == null) return ResponseEntity.status(400).body("Missing chunk #" + i);
			databaseService.addChunkToFile(newFileId, hashes.get(i), i);
		}

		// Cleanup
		UPLOAD_METADATA_MAP.remove(uploadId);
		UPLOAD_CHUNKS_MAP.remove(uploadId);

		System.out.println("REST: Finalized file " + info.name);
		return ResponseEntity.ok(newFileId);
	}

	// Helper Record
	record FileInfo(String name, long size) {}
}