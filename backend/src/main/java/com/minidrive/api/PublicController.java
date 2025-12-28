package com.minidrive.api;

import com.minidrive.db.DatabaseService;
import com.minidrive.storage.StorageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.util.List;
import java.util.Map;

@RestController
@CrossOrigin(origins = "http://localhost:3000") // Allow Frontend
@RequestMapping("/api/public")
public class PublicController {

	@Autowired private DatabaseService databaseService;
	@Autowired private StorageService storageService;

	// View/Download Shared File
	@GetMapping("/share/{token}")
	public ResponseEntity<StreamingResponseBody> getSharedFile(@PathVariable String token) {

		// 1. Find File Metadata by Token
		Map<String, Object> metadata = databaseService.getFileByShareToken(token);
		if (metadata == null) return ResponseEntity.notFound().build();

		String filename = (String) metadata.get("name");
		String fileId = (String) metadata.get("id");
		Long size = (Long) metadata.get("size");

		// 2. Get Chunks
		List<String> chunks = databaseService.getFileChunks(fileId);

		// 3. Stream
		StreamingResponseBody stream = outputStream -> {
			for (String hash : chunks) {
				outputStream.write(storageService.downloadChunk(hash));
				outputStream.flush();
			}
		};

		// Determine content type (for preview in browser)
		String contentType = "application/octet-stream";
		if (filename.endsWith(".jpg")) contentType = "image/jpeg";
		else if (filename.endsWith(".mp4")) contentType = "video/mp4";
		else if (filename.endsWith(".pdf")) contentType = "application/pdf";

		return ResponseEntity.ok()
				.header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
				.contentLength(size)
				.contentType(MediaType.parseMediaType(contentType))
				.body(stream);
	}
}