package com.minidrive.api;

import com.minidrive.db.DatabaseService;
import com.minidrive.memory.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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
            Authentication auth) {

        String query = request.get("query");
        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Query is required"));
        }

        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Authentication required"));
        }

        try {
            String username = auth.getPrincipal().toString();
            String userId = databaseService.getUserId(username);
            
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
            String errorMsg = e.getMessage();
            // Check for common pgvector/database issues
            if (errorMsg != null && (errorMsg.contains("vector") || errorMsg.contains("file_embeddings"))) {
                return ResponseEntity.ok(Map.of(
                    "answer", "⚠️ **Sanchay Memory is not fully set up.**\n\nThe pgvector extension needs to be installed in your PostgreSQL database. Please contact your administrator or run:\n```sql\nCREATE EXTENSION vector;\n```\n\nOnce installed, restart the backend.",
                    "sources", List.of()
                ));
            }
            return ResponseEntity.internalServerError()
                .body(Map.of("error", errorMsg != null ? errorMsg : "Unknown error occurred"));
        }
    }

    /**
     * Get graph data for 3D visualization
     */
    @GetMapping("/graph")
    public ResponseEntity<?> getGraph(
            @RequestParam(defaultValue = "0.3") float threshold,
            Authentication auth) {

        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Authentication required"));
        }

        try {
            String username = auth.getPrincipal().toString();
            String userId = databaseService.getUserId(username);
            
            // Get file similarities above threshold
            List<VectorRepository.FileSimilarity> similarities = 
                vectorRepository.getFileSimilarities(userId, threshold);
            
            // Get all files as nodes
            List<Map<String, Object>> files = databaseService.getAllFiles(username);
            
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
            String errorMsg = e.getMessage();
            // Return empty graph on pgvector issues
            if (errorMsg != null && (errorMsg.contains("vector") || errorMsg.contains("file_embeddings"))) {
                return ResponseEntity.ok(Map.of(
                    "nodes", List.of(),
                    "edges", List.of()
                ));
            }
            return ResponseEntity.internalServerError()
                .body(Map.of("error", errorMsg != null ? errorMsg : "Unknown error"));
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

    @Autowired(required = false)
    private MemoryWorker memoryWorker;

    @Autowired(required = false)
    private TextExtractionService textExtractionService;

    /**
     * Process all existing files for Sanchay Memory.
     * This enables semantic search on documents uploaded before Memory was enabled.
     */
    @PostMapping("/process-all")
    public ResponseEntity<?> processAllFiles(Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Authentication required"));
        }

        if (memoryWorker == null) {
            return ResponseEntity.ok(Map.of(
                "message", "Memory worker not available",
                "processed", 0
            ));
        }

        try {
            String username = auth.getPrincipal().toString();
            String userId = databaseService.getUserId(username);
            List<Map<String, Object>> files = databaseService.getAllFiles(username);
            
            int processed = 0;
            int skipped = 0;
            
            for (Map<String, Object> file : files) {
                String filename = (String) file.get("name");
                String fileId = file.get("file_id").toString();
                
                // Only process supported file types
                if (textExtractionService != null && textExtractionService.supportsExtraction(filename)) {
                    memoryWorker.processFileAsync(UUID.fromString(fileId), userId, filename, username);
                    processed++;
                } else {
                    skipped++;
                }
            }
            
            return ResponseEntity.ok(Map.of(
                "message", "Processing started for " + processed + " files",
                "processed", processed,
                "skipped", skipped,
                "supportedTypes", "pdf, doc, docx, txt, rtf, odt, md, html, json"
            ));
            
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", e.getMessage()));
        }
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
