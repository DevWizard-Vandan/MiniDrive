-- 1. CLEANUP
DROP TABLE IF EXISTS file_chunks;
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS folders;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS global_chunks;

-- 2. USERS
CREATE TABLE users (
                       id UUID PRIMARY KEY,
                       username VARCHAR(50) UNIQUE NOT NULL,
                       password VARCHAR(255) NOT NULL,
                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. FOLDERS (Added is_trashed, is_starred)
CREATE TABLE folders (
                         id UUID PRIMARY KEY,
                         name VARCHAR(255) NOT NULL,
                         parent_id UUID REFERENCES folders(id),
                         owner_id UUID REFERENCES users(id),
                         is_trashed BOOLEAN DEFAULT FALSE,
                         is_starred BOOLEAN DEFAULT FALSE,
                         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. FILES (Added is_trashed, is_starred)
CREATE TABLE files (
                       file_id UUID PRIMARY KEY,
                       filename VARCHAR(255),
                       size BIGINT,
                       owner_id UUID REFERENCES users(id),
                       folder_id UUID REFERENCES folders(id),
                       is_trashed BOOLEAN DEFAULT FALSE,
                       is_starred BOOLEAN DEFAULT FALSE,
                       uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. CHUNKS
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

-- 7. HOTFIX: Add Share Token
ALTER TABLE files ADD COLUMN IF NOT EXISTS share_token VARCHAR(64) UNIQUE;

ALTER TABLE files
DROP CONSTRAINT files_folder_id_fkey,
ADD CONSTRAINT files_folder_id_fkey
    FOREIGN KEY (folder_id)
    REFERENCES folders(id)
    ON DELETE CASCADE;