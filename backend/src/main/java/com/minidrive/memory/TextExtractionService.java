package com.minidrive.memory;

import org.apache.tika.Tika;
import org.apache.tika.config.TikaConfig;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.parser.ocr.TesseractOCRConfig;
import org.apache.tika.parser.pdf.PDFParserConfig;
import org.apache.tika.sax.BodyContentHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Text extraction service using Apache Tika.
 * Supports PDF (including scanned/image PDFs with OCR), DOCX, TXT, and other document formats.
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
     * Extract text from document bytes.
     * For text files, reads directly. For others, uses Tika.
     */
    public String extractTextFromBytes(byte[] data, String filename) {
        try {
            String lowerFilename = filename.toLowerCase();
            
            // For plain text files, read directly as string
            if (lowerFilename.endsWith(".txt") || lowerFilename.endsWith(".md") || 
                lowerFilename.endsWith(".json") || lowerFilename.endsWith(".html") ||
                lowerFilename.endsWith(".htm") || lowerFilename.endsWith(".xml")) {
                String text = new String(data, java.nio.charset.StandardCharsets.UTF_8);
                logger.info("Direct read {} characters from {}", text.length(), filename);
                return text;
            }
            
            // For other files, use InputStream-based extraction
            return extractText(new java.io.ByteArrayInputStream(data), filename);
            
        } catch (Exception e) {
            logger.error("Text extraction from bytes failed for {}: {}", filename, e.getMessage());
            return null;
        }
    }

    /**
     * Extract text from document stream.
     * For PDFs, enables OCR for scanned/image-based documents if Tesseract is available.
     */
    public String extractText(InputStream inputStream, String filename) {
        try {
            String lowerFilename = filename.toLowerCase();
            
            // For PDFs, use enhanced parsing with OCR support
            if (lowerFilename.endsWith(".pdf")) {
                return extractTextFromPdf(inputStream, filename);
            }
            
            // For other files, use standard Tika
            String text = tika.parseToString(inputStream);
            logger.info("Extracted {} characters from {}", text.length(), filename);
            return text;
            
        } catch (Exception e) {
            logger.error("Text extraction failed for {}: {}", filename, e.getMessage());
            return null;
        }
    }

    /**
     * Extract text from PDF with OCR support for scanned documents.
     */
    private String extractTextFromPdf(InputStream inputStream, String filename) {
        try {
            // Configure PDF parser with OCR enabled
            PDFParserConfig pdfConfig = new PDFParserConfig();
            pdfConfig.setExtractInlineImages(true);
            pdfConfig.setExtractUniqueInlineImagesOnly(true);
            pdfConfig.setOcrStrategy(PDFParserConfig.OCR_STRATEGY.OCR_AND_TEXT_EXTRACTION);
            
            // Configure TesseractOCR
            TesseractOCRConfig ocrConfig = new TesseractOCRConfig();
            ocrConfig.setLanguage("eng");
            
            // Set up parse context
            ParseContext context = new ParseContext();
            context.set(PDFParserConfig.class, pdfConfig);
            context.set(TesseractOCRConfig.class, ocrConfig);
            
            // Parse with large content limit
            AutoDetectParser parser = new AutoDetectParser();
            BodyContentHandler handler = new BodyContentHandler(-1); // unlimited
            Metadata metadata = new Metadata();
            
            parser.parse(inputStream, handler, metadata, context);
            
            String text = handler.toString();
            logger.info("Extracted {} characters from PDF {} (OCR enabled)", text.length(), filename);
            return text;
            
        } catch (Exception e) {
            logger.warn("PDF OCR extraction failed for {}, trying basic extraction: {}", filename, e.getMessage());
            
            // Fallback to basic Tika parsing
            try {
                String text = tika.parseToString(inputStream);
                logger.info("Basic extraction: {} characters from {}", text.length(), filename);
                return text;
            } catch (Exception e2) {
                logger.error("All extraction methods failed for {}: {}", filename, e2.getMessage());
                return null;
            }
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
        
        // If text is very short, just return it as a single chunk
        if (text.length() < 100) {
            chunks.add(new TextChunk(fileId, 0, text));
            logger.info("Created 1 chunk (short text) for file {}", fileId);
            return chunks;
        }
        
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
            
            // Move start with overlap, but ensure we don't go backwards
            int nextStart = end - overlapChars;
            if (nextStart <= start) {
                // Prevent infinite loop - move forward at least 1/3 of chunk size
                nextStart = start + Math.max(chunkChars / 3, 100);
            }
            start = nextStart;
            
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
