-- 1. CLEANUP
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS file_chunks CASCADE;
DROP TABLE IF EXISTS files CASCADE;
DROP TABLE IF EXISTS folders CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS global_chunks CASCADE;

-- 2. USERS
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    encryption_key TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. FOLDERS
CREATE TABLE folders (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id UUID,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_trashed BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    is_vault BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_folder_parent FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- 4. FILES
CREATE TABLE files (
    file_id UUID PRIMARY KEY,
    filename VARCHAR(255),
    size BIGINT,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    folder_id UUID,
    is_trashed BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    is_vault BOOLEAN DEFAULT FALSE,
    share_token VARCHAR(64) UNIQUE,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_file_folder FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- 5. CHUNKS
CREATE TABLE file_chunks (
    file_id UUID,
    chunk_hash VARCHAR(64),
    chunk_index INT,
    PRIMARY KEY (file_id, chunk_index),
    CONSTRAINT fk_chunk_file FOREIGN KEY (file_id) REFERENCES files(file_id) ON DELETE CASCADE
);

CREATE TABLE global_chunks (
    chunk_hash VARCHAR(64) PRIMARY KEY,
    ref_count INT DEFAULT 1
);

-- 6. ACTIVITIES (Correctly added)
CREATE TABLE activities (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50),
    file_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
