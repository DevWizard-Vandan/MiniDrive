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
        // Fallback response when Ollama is not available
        if (chatModel == null) {
            return generateFallbackResponse(query, context);
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
            logger.warn("Ollama generation failed, using fallback: {}", e.getMessage());
            return generateFallbackResponse(query, context);
        }
    }

    /**
     * Fallback response when LLM is unavailable - provides relevant excerpts
     */
    private String generateFallbackResponse(String query, List<VectorRepository.SimilarChunk> context) {
        if (context.isEmpty()) {
            return "I couldn't find any files matching your query.";
        }

        StringBuilder response = new StringBuilder();
        response.append("📚 **Based on your files, here's what I found:**\n\n");

        for (int i = 0; i < Math.min(3, context.size()); i++) {
            VectorRepository.SimilarChunk chunk = context.get(i);
            String preview = chunk.content();
            if (preview.length() > 300) {
                preview = preview.substring(0, 300) + "...";
            }
            
            response.append("**").append(chunk.filename()).append("** (")
                    .append(Math.round(chunk.similarity() * 100)).append("% match):\n");
            response.append("_").append(preview.replace("\n", " ")).append("_\n\n");
        }

        response.append("\n💡 *For AI-powered answers, please start Ollama locally with:* `ollama run deepseek-r1:1.5b`");
        
        return response.toString();
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
