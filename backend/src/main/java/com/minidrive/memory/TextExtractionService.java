package com.minidrive.memory;

import org.apache.tika.Tika;
import org.apache.tika.exception.TikaException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Text extraction service using Apache Tika.
 * Supports PDF, DOCX, TXT, and other document formats.
 */
@Service
public class TextExtractionService {

    private static final Logger logger = LoggerFactory.getLogger(TextExtractionService.class);
    
    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(
        "pdf", "doc", "docx", "txt", "rtf", "odt", "md", "html", "htm", "xml", "json"
    );
    
    private static final int CHUNK_SIZE = 500; // tokens (approx chars / 4)
    private static final int CHUNK_OVERLAP = 50; // overlap for context continuity

    private final Tika tika = new Tika();

    /**
     * Check if file type supports text extraction
     */
    public boolean supportsExtraction(String filename) {
        if (filename == null) return false;
        String ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
        return SUPPORTED_EXTENSIONS.contains(ext);
    }

    /**
     * Extract text from document stream
     */
    public String extractText(InputStream inputStream, String filename) {
        try {
            String text = tika.parseToString(inputStream);
            logger.info("Extracted {} characters from {}", text.length(), filename);
            return text;
        } catch (Exception e) {
            logger.error("Text extraction failed for {}: {}", filename, e.getMessage());
            return null;
        }
    }

    /**
     * Chunk text for embedding generation.
     * Uses sliding window with overlap for context preservation.
     */
    public List<TextChunk> chunkText(String text, String fileId) {
        List<TextChunk> chunks = new ArrayList<>();
        
        if (text == null || text.isBlank()) {
            return chunks;
        }

        // Clean and normalize text
        text = text.replaceAll("\\s+", " ").trim();
        
        // Approximate token count (chars / 4)
        int chunkChars = CHUNK_SIZE * 4;
        int overlapChars = CHUNK_OVERLAP * 4;
        
        int start = 0;
        int chunkIndex = 0;
        
        while (start < text.length()) {
            int end = Math.min(start + chunkChars, text.length());
            
            // Try to break at sentence boundary
            if (end < text.length()) {
                int lastPeriod = text.lastIndexOf(". ", end);
                if (lastPeriod > start + chunkChars / 2) {
                    end = lastPeriod + 1;
                }
            }
            
            String chunkContent = text.substring(start, end).trim();
            
            if (!chunkContent.isEmpty()) {
                chunks.add(new TextChunk(fileId, chunkIndex++, chunkContent));
            }
            
            // Move start with overlap
            start = end - overlapChars;
            if (start >= text.length()) break;
        }
        
        logger.info("Created {} chunks for file {}", chunks.size(), fileId);
        return chunks;
    }

    /**
     * Text chunk data class
     */
    public record TextChunk(String fileId, int chunkIndex, String content) {}
}
