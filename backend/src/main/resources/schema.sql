-- 1. CLEANUP (Drop in correct order)
DROP TABLE IF EXISTS file_chunks;
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS folders; -- NEW
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS global_chunks;

-- 2. CREATE TABLES
CREATE TABLE users (
                       id UUID PRIMARY KEY,
                       username VARCHAR(50) UNIQUE NOT NULL,
                       password VARCHAR(255) NOT NULL,
                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE folders (
                         id UUID PRIMARY KEY,
                         name VARCHAR(255) NOT NULL,
                         parent_id UUID REFERENCES folders(id), -- Folders inside folders
                         owner_id UUID REFERENCES users(id),
                         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE files (
                       file_id UUID PRIMARY KEY,
                       filename VARCHAR(255),
                       size BIGINT,
                       owner_id UUID REFERENCES users(id),
                       folder_id UUID REFERENCES folders(id), -- Link to Folder (NULL = Root)
                       uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE file_chunks (
                             file_id UUID REFERENCES files(file_id),
                             chunk_hash VARCHAR(64),
                             chunk_index INT,
                             PRIMARY KEY (file_id, chunk_index)
);

CREATE TABLE global_chunks (
                               chunk_hash VARCHAR(64) PRIMARY KEY,
                               ref_count INT DEFAULT 1
);