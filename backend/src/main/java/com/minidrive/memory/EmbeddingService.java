package com.minidrive.memory;

import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.model.embedding.AllMiniLmL6V2EmbeddingModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Embedding service using all-MiniLM-L6-v2 (384 dimensions).
 * Runs locally - no external API calls.
 */
@Service
public class EmbeddingService {

    private static final Logger logger = LoggerFactory.getLogger(EmbeddingService.class);
    
    private EmbeddingModel embeddingModel;

    @PostConstruct
    public void init() {
        logger.info("Initializing embedding model: all-MiniLM-L6-v2");
        this.embeddingModel = new AllMiniLmL6V2EmbeddingModel();
        logger.info("Embedding model ready");
    }

    /**
     * Generate embedding for a single text chunk
     */
    public float[] embed(String text) {
        if (text == null || text.isBlank()) {
            return new float[384];
        }
        
        try {
            Embedding embedding = embeddingModel.embed(text).content();
            return embedding.vector();
        } catch (Exception e) {
            logger.error("Embedding generation failed: {}", e.getMessage());
            return new float[384];
        }
    }

    /**
     * Batch embed multiple chunks for efficiency
     */
    public List<float[]> embedBatch(List<String> texts) {
        return texts.stream()
            .map(this::embed)
            .collect(Collectors.toList());
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    public float cosineSimilarity(float[] a, float[] b) {
        if (a.length != b.length) return 0f;
        
        float dotProduct = 0f;
        float normA = 0f;
        float normB = 0f;
        
        for (int i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        return (float) (dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)));
    }
}
