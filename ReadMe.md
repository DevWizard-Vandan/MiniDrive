# MiniDrive: Hybrid Distributed File System

MiniDrive is a production-grade file storage engine that implements **Content-Addressable Storage (CAS)** and **Client-Side Deduplication**.

Unlike standard file uploaders, MiniDrive calculates the SHA-256 hash of file chunks before uploading. If the server detects that a chunk already exists (from *any* user), it skips the network transfer, allowing for **Instant Uploads** and massive storage savings.

## 🚀 Key Features
* **Hybrid Architecture:** Uses **PostgreSQL** for ACID-compliant metadata and **MinIO** (S3-compatible) for blob storage.
* **Deduplication Engine:** Eliminates redundant data storage at the block level.
* **Resumable Uploads:** Files are split into 1MB chunks; failures only require retrying the missing chunk.
* **Full Stack:** Java Spring Boot (Backend) + React/Tailwind (Frontend) + Docker (Infrastructure).

## 🛠 Tech Stack
* **Backend:** Java 21, Spring Boot 3, gRPC (Internal), REST (External).
* **Data Layer:** PostgreSQL (Metadata), MinIO (Object Storage), Redis (Caching - Optional).
* **Frontend:** React.js, Tailwind CSS.
* **DevOps:** Docker Compose, Maven.

## ⚡ How to Run
1.  **Start Infrastructure:**
    ```bash
    docker-compose up -d
    ```
2.  **Start Backend:**
    Run `MiniDriveApp.java` (Server runs on port 8080).
3.  **Start Frontend:**
    ```bash
    cd drive-ui
    npm start
    ```

## 🧠 Architecture
**Client (React)** -> Slices File -> Hashes Chunk -> **API Gateway (Spring)** -> **Deduplication Check (Postgres)** -> **Object Storage (MinIO)**