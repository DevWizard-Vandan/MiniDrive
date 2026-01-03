-- Sanchay Memory: pgvector schema for knowledge graph
-- Run this after enabling the vector extension

-- Enable pgvector extension (requires superuser once)
CREATE EXTENSION IF NOT EXISTS vector;

-- File embeddings table
-- Uses UUID to match files table, with CASCADE on delete
CREATE TABLE IF NOT EXISTS file_embeddings (
    id SERIAL PRIMARY KEY,
    file_id UUID NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_content TEXT NOT NULL,
    embedding vector(384), -- all-minilm-l6-v2 produces 384-dim vectors
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_id, chunk_index)
);

-- Index for fast similarity search using IVFFlat
-- Approximate search, faster than exact for large datasets
CREATE INDEX IF NOT EXISTS idx_file_embeddings_vector 
    ON file_embeddings USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);

-- Index for filtering by user
CREATE INDEX IF NOT EXISTS idx_file_embeddings_user 
    ON file_embeddings(user_id);

-- Index for looking up chunks by file
CREATE INDEX IF NOT EXISTS idx_file_embeddings_file 
    ON file_embeddings(file_id);

-- File processing status tracking
CREATE TABLE IF NOT EXISTS file_processing_status (
    file_id UUID PRIMARY KEY REFERENCES files(file_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    error_message TEXT,
    chunks_count INTEGER DEFAULT 0,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Semantic file clusters (for auto-clustering visualization)
CREATE TABLE IF NOT EXISTS file_clusters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cluster_name VARCHAR(255),
    cluster_color VARCHAR(20),
    centroid vector(384),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-many: files to clusters
CREATE TABLE IF NOT EXISTS file_cluster_members (
    file_id UUID NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
    cluster_id INTEGER NOT NULL REFERENCES file_clusters(id) ON DELETE CASCADE,
    similarity_score FLOAT,
    PRIMARY KEY(file_id, cluster_id)
);
