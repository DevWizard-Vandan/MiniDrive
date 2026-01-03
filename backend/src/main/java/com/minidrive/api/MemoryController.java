package com.minidrive.api;

import com.minidrive.db.DatabaseService;
import com.minidrive.memory.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Controller for Sanchay Memory - RAG chat and graph visualization.
 */
@RestController
@RequestMapping("/api/memory")
public class MemoryController {

    @Autowired
    private EmbeddingService embeddingService;

    @Autowired
    private VectorRepository vectorRepository;

    @Autowired
    private OllamaService ollamaService;

    @Autowired
    private DatabaseService databaseService;

    /**
     * RAG Chat endpoint - "Chat with Drive"
     */
    @PostMapping("/chat")
    public ResponseEntity<?> chat(
            @RequestBody Map<String, String> request,
            @AuthenticationPrincipal UserDetails userDetails) {

        String query = request.get("query");
        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Query is required"));
        }

        try {
            int userId = databaseService.getUserId(userDetails.getUsername());
            
            // 1. Embed the query
            float[] queryEmbedding = embeddingService.embed(query);
            
            // 2. Search for similar chunks
            List<VectorRepository.SimilarChunk> similarChunks = 
                vectorRepository.searchSimilar(userId, queryEmbedding, 5);
            
            if (similarChunks.isEmpty()) {
                return ResponseEntity.ok(Map.of(
                    "answer", "I couldn't find any relevant documents in your drive for this query.",
                    "sources", List.of()
                ));
            }
            
            // 3. Generate response using Ollama
            String answer = ollamaService.generateResponse(query, similarChunks);
            
            // 4. Format sources
            List<Map<String, Object>> sources = similarChunks.stream()
                .map(chunk -> Map.<String, Object>of(
                    "fileId", chunk.fileId().toString(),
                    "filename", chunk.filename(),
                    "similarity", Math.round(chunk.similarity() * 100),
                    "preview", chunk.content().substring(0, Math.min(200, chunk.content().length())) + "..."
                ))
                .toList();
            
            return ResponseEntity.ok(Map.of(
                "answer", answer,
                "sources", sources
            ));

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get graph data for 3D visualization
     */
    @GetMapping("/graph")
    public ResponseEntity<?> getGraph(
            @RequestParam(defaultValue = "0.3") float threshold,
            @AuthenticationPrincipal UserDetails userDetails) {

        try {
            int userId = databaseService.getUserId(userDetails.getUsername());
            
            // Get file similarities above threshold
            List<VectorRepository.FileSimilarity> similarities = 
                vectorRepository.getFileSimilarities(userId, threshold);
            
            // Get all files as nodes
            List<Map<String, Object>> files = databaseService.getAllFiles(userDetails.getUsername());
            
            List<Map<String, Object>> nodes = files.stream()
                .map(f -> Map.<String, Object>of(
                    "id", f.get("file_id").toString(),
                    "name", f.get("name"),
                    "size", f.get("size"),
                    "type", getFileType((String) f.get("name"))
                ))
                .toList();
            
            List<Map<String, Object>> edges = similarities.stream()
                .map(s -> Map.<String, Object>of(
                    "source", s.fileA().toString(),
                    "target", s.fileB().toString(),
                    "weight", s.similarity()
                ))
                .toList();
            
            return ResponseEntity.ok(Map.of(
                "nodes", nodes,
                "edges", edges
            ));

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get processing status for a file
     */
    @GetMapping("/status/{fileId}")
    public ResponseEntity<?> getStatus(@PathVariable String fileId) {
        try {
            Map<String, Object> status = vectorRepository.getProcessingStatus(UUID.fromString(fileId));
            if (status == null) {
                return ResponseEntity.ok(Map.of("status", "not_processed"));
            }
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get/set Ollama model
     */
    @GetMapping("/settings/model")
    public ResponseEntity<?> getModel() {
        return ResponseEntity.ok(Map.of(
            "model", ollamaService.getCurrentModel(),
            "available", ollamaService.isAvailable()
        ));
    }

    @PostMapping("/settings/model")
    public ResponseEntity<?> setModel(@RequestBody Map<String, String> request) {
        String model = request.get("model");
        if (model == null || model.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Model name required"));
        }
        
        ollamaService.setModel(model);
        return ResponseEntity.ok(Map.of("success", true, "model", model));
    }

    private String getFileType(String filename) {
        String ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
        return switch (ext) {
            case "pdf" -> "document";
            case "doc", "docx", "txt", "md" -> "text";
            case "jpg", "png", "gif", "webp" -> "image";
            case "mp4", "webm", "mov" -> "video";
            default -> "file";
        };
    }
}
