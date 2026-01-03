package com.minidrive.memory;

import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.ollama.OllamaChatModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.util.List;

/**
 * Ollama integration for RAG chat.
 * Connects to local Ollama instance for LLM responses.
 */
@Service
public class OllamaService {

    private static final Logger logger = LoggerFactory.getLogger(OllamaService.class);

    @Value("${ollama.base-url:http://localhost:11434}")
    private String ollamaBaseUrl;

    @Value("${ollama.model:deepseek-r1:1.5b}")
    private String defaultModel;

    @Value("${ollama.timeout:120}")
    private int timeoutSeconds;

    private ChatLanguageModel chatModel;

    @PostConstruct
    public void init() {
        try {
            this.chatModel = OllamaChatModel.builder()
                .baseUrl(ollamaBaseUrl)
                .modelName(defaultModel)
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .build();
            logger.info("Ollama connected: {} at {}", defaultModel, ollamaBaseUrl);
        } catch (Exception e) {
            logger.warn("Ollama not available: {}. Chat features disabled.", e.getMessage());
        }
    }

    /**
     * Generate RAG response with context from similar chunks
     */
    public String generateResponse(String query, List<VectorRepository.SimilarChunk> context) {
        if (chatModel == null) {
            return "Chat is not available. Please ensure Ollama is running.";
        }

        // Build context string
        StringBuilder contextBuilder = new StringBuilder();
        for (VectorRepository.SimilarChunk chunk : context) {
            contextBuilder.append("--- From: ").append(chunk.filename()).append(" ---\n");
            contextBuilder.append(chunk.content()).append("\n\n");
        }

        String prompt = buildRAGPrompt(query, contextBuilder.toString());

        try {
            String response = chatModel.generate(prompt);
            return response;
        } catch (Exception e) {
            logger.error("Ollama generation failed: {}", e.getMessage());
            return "Sorry, I couldn't process your query. Error: " + e.getMessage();
        }
    }

    /**
     * Change the active model
     */
    public void setModel(String modelName) {
        this.chatModel = OllamaChatModel.builder()
            .baseUrl(ollamaBaseUrl)
            .modelName(modelName)
            .timeout(Duration.ofSeconds(timeoutSeconds))
            .build();
        logger.info("Switched to model: {}", modelName);
    }

    /**
     * Get current model info
     */
    public String getCurrentModel() {
        return defaultModel;
    }

    /**
     * Check if Ollama is available
     */
    public boolean isAvailable() {
        return chatModel != null;
    }

    private String buildRAGPrompt(String query, String context) {
        return """
            You are a helpful assistant for SanchayCloud, a personal file storage system.
            Answer the user's question based ONLY on the following context from their files.
            If the answer cannot be found in the context, say so clearly.
            
            CONTEXT:
            %s
            
            USER QUESTION: %s
            
            ANSWER:
            """.formatted(context, query);
    }
}
