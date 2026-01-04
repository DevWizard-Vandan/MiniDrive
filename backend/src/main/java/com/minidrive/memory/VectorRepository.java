package com.minidrive.memory;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Array;
import java.util.*;

/**
 * Repository for storing and querying vector embeddings.
 */
@Repository
public class VectorRepository {

    private static final Logger logger = LoggerFactory.getLogger(VectorRepository.class);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * Save a file chunk with its embedding
     */
    public void saveChunkEmbedding(UUID fileId, String ownerId, int chunkIndex, String content, float[] embedding) {
        String vectorStr = arrayToVectorString(embedding);
        
        String sql = """
            INSERT INTO file_embeddings (file_id, user_id, chunk_index, chunk_content, embedding)
            VALUES (?::uuid, ?::uuid, ?, ?, ?::vector)
            ON CONFLICT (file_id, chunk_index) DO UPDATE SET
                chunk_content = EXCLUDED.chunk_content,
                embedding = EXCLUDED.embedding
        """;
        
        jdbcTemplate.update(sql, fileId.toString(), ownerId, chunkIndex, content, vectorStr);
    }

    /**
     * Delete all embeddings for a file
     */
    public void deleteFileEmbeddings(UUID fileId) {
        jdbcTemplate.update("DELETE FROM file_embeddings WHERE file_id = ?::uuid", fileId.toString());
    }

    /**
     * Search for similar chunks across user's files
     */
    public List<SimilarChunk> searchSimilar(String userId, float[] queryEmbedding, int limit) {
        String vectorStr = arrayToVectorString(queryEmbedding);
        
        String sql = """
            SELECT fe.file_id, fe.chunk_index, fe.chunk_content, f.filename as filename,
                   1 - (fe.embedding <=> ?::vector) AS similarity
            FROM file_embeddings fe
            JOIN files f ON f.file_id = fe.file_id
            WHERE fe.user_id = ?::uuid
            ORDER BY fe.embedding <=> ?::vector
            LIMIT ?
        """;
        
        return jdbcTemplate.query(sql, (rs, rowNum) -> new SimilarChunk(
            UUID.fromString(rs.getString("file_id")),
            rs.getString("filename"),
            rs.getInt("chunk_index"),
            rs.getString("chunk_content"),
            rs.getFloat("similarity")
        ), vectorStr, userId, vectorStr, limit);
    }

    /**
     * Get file similarity matrix for graph visualization
     */
    public List<FileSimilarity> getFileSimilarities(String userId, float threshold) {
        // Get average embeddings per file
        String sql = """
            WITH file_avg AS (
                SELECT file_id, AVG(embedding) as avg_embedding
                FROM file_embeddings
                WHERE user_id = ?::uuid
                GROUP BY file_id
            )
            SELECT 
                a.file_id as file_a, 
                b.file_id as file_b,
                1 - (a.avg_embedding <=> b.avg_embedding) as similarity
            FROM file_avg a
            CROSS JOIN file_avg b
            WHERE a.file_id < b.file_id
            AND 1 - (a.avg_embedding <=> b.avg_embedding) > ?
            ORDER BY similarity DESC
        """;
        
        return jdbcTemplate.query(sql, (rs, rowNum) -> new FileSimilarity(
            UUID.fromString(rs.getString("file_a")),
            UUID.fromString(rs.getString("file_b")),
            rs.getFloat("similarity")
        ), userId, threshold);
    }

    /**
     * Update processing status
     */
    public void updateProcessingStatus(UUID fileId, String status, Integer chunksCount, String errorMessage) {
        String sql = """
            INSERT INTO file_processing_status (file_id, status, chunks_count, error_message, processed_at)
            VALUES (?::uuid, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (file_id) DO UPDATE SET
                status = EXCLUDED.status,
                chunks_count = EXCLUDED.chunks_count,
                error_message = EXCLUDED.error_message,
                processed_at = CURRENT_TIMESTAMP
        """;
        
        jdbcTemplate.update(sql, fileId.toString(), status, chunksCount, errorMessage);
    }

    /**
     * Get processing status
     */
    public Map<String, Object> getProcessingStatus(UUID fileId) {
        String sql = "SELECT * FROM file_processing_status WHERE file_id = ?::uuid";
        
        try {
            return jdbcTemplate.queryForMap(sql, fileId.toString());
        } catch (Exception e) {
            return null;
        }
    }

    // Helper to convert float array to pgvector format
    private String arrayToVectorString(float[] arr) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(arr[i]);
        }
        sb.append("]");
        return sb.toString();
    }

    // Data classes
    public record SimilarChunk(UUID fileId, String filename, int chunkIndex, String content, float similarity) {}
    public record FileSimilarity(UUID fileA, UUID fileB, float similarity) {}
}
