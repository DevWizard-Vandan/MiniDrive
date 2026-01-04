package com.minidrive.memory;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;

/**
 * Initializes Sanchay Memory database schema on startup.
 * Creates required tables and pgvector extension.
 */
@Component
public class MemorySchemaInitializer {

    private static final Logger logger = LoggerFactory.getLogger(MemorySchemaInitializer.class);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void initSchema() {
        try {
            // Try to enable pgvector extension
            try {
                jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS vector");
                logger.info("✅ Memory: pgvector extension enabled");
            } catch (Exception e) {
                logger.warn("⚠️ Memory: Could not enable pgvector extension (may need superuser): {}", e.getMessage());
                logger.warn("⚠️ Memory: Chat with Drive and Graph View will not work until pgvector is installed");
                return; // Can't continue without pgvector
            }

            // Create file_embeddings table
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS file_embeddings (
                    id SERIAL PRIMARY KEY,
                    file_id UUID NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    chunk_index INTEGER NOT NULL,
                    chunk_content TEXT NOT NULL,
                    embedding vector(384),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(file_id, chunk_index)
                )
            """);

            // Create file_processing_status table
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS file_processing_status (
                    file_id UUID PRIMARY KEY REFERENCES files(file_id) ON DELETE CASCADE,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    error_message TEXT,
                    chunks_count INTEGER DEFAULT 0,
                    processed_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """);

            logger.info("✅ Memory: Schema initialized successfully");

        } catch (Exception e) {
            logger.error("❌ Memory: Schema initialization failed: {}", e.getMessage());
            // Don't fail startup, just disable memory features
        }
    }
}
