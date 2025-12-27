# MiniDrive: Hybrid Distributed File System

![Java](https://img.shields.io/badge/Java-21-orange) ![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.4-green) ![React](https://img.shields.io/badge/React-18-blue) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)

**MiniDrive** is a production-grade file storage engine that implements **Content-Addressable Storage (CAS)** and **Client-Side Deduplication**.

Unlike standard file uploaders, MiniDrive calculates the SHA-256 hash of file chunks before uploading. If the server detects that a chunk already exists (from *any* user), it skips the network transfer, allowing for **Instant Uploads** and massive bandwidth savings.

---

## 🏗 Architecture

The system uses a **Hybrid Architecture**, utilizing **PostgreSQL** for ACID-compliant metadata management and **MinIO** (S3-compatible) for scalable object storage.

```mermaid
graph TD
    Client[React Frontend] -->|1. Init Upload (REST)| API[Spring Boot API Gateway]
    Client -->|2. Hash & Slice Blocks| Client
    Client -->|3. Check Block Existence (REST)| API
    API -->|4. Query Metadata| DB[(PostgreSQL)]
    
    alt Block Exists
        API --o Client: Skip Upload (Deduplicated)
    else Block Missing
        Client -->|5. Upload Chunk (REST/gRPC)| API
        API -->|6. Stream Bytes| Storage[MinIO Object Store]
    end
    
    API -->|7. Finalize File| DB
```

---

## 🚀 Key Features

- ⚡ **Client-Side Deduplication**: Files are sliced into 1MB chunks. SHA-256 hashes are checked against the server before data transfer. Redundant data is never sent over the network.

- 💾 **Hybrid Storage Engine**:
    - **Metadata**: Relational data (Owners, File Hierarchy, Permissions) stored in PostgreSQL.
    - **Blob Data**: Binary chunks stored in MinIO (Object Storage), decoupled from the application server for horizontal scalability.

- 🔄 **Resumable Uploads**: Failures only require retrying specific missing chunks, not the entire file.

- 🐳 **Dockerized Infrastructure**: Entire stack (App, DB, Object Store) spins up with a single `docker-compose up` command.

---

## 🧠 System Design & Trade-offs

### 1. Synchronous Deduplication (The "Twist")

Most systems deduplicate asynchronously (save first, clean later). MiniDrive implements **Synchronous Deduplication**:

1. **Hashing**: Client calculates hash of a 1MB block.
2. **Query**: Client asks Server: "Do you have hash `abc...`?"
3. **Optimization**: If Server says `Yes`, the client skips the network transfer.
4. **Result**: Uploading a 1GB file that already exists physically takes milliseconds instead of minutes.

### 2. Hybrid Communication Strategy

- **REST (Port 8080)**: Used for Frontend-to-Backend communication. REST was chosen over gRPC-Web for the browser to simplify the "Drag and Drop" implementation and avoid complex Envoy proxy setups for a portfolio MVP.

- **gRPC Ready**: The backend service layer is structured to support internal gRPC calls. For future microservices (e.g., a compression worker), gRPC would be used for its low-latency Protobuf serialization.

### 3. MinIO vs. Local Filesystem

**Why MinIO?** Storing files on a local disk (`C:\uploads`) binds the application to a single stateful server, making scaling impossible. By using MinIO, the storage layer is stateless and decoupled. This mimics a real AWS S3 production environment.

---

## 🛡 Fault Tolerance

| Scenario | Handling Strategy |
|----------|-------------------|
| **Network Cut During Upload** | **Resumable Chunks**: Since files are split into independent chunks, the client simply re-requests the "Missing Chunks" list from the server and resumes. |
| **Concurrent Uploads** | **Optimistic Locking**: If two users upload the same file simultaneously, the database ensures only one physical copy is written to MinIO, but both users receive valid file references. |
| **Corrupted Data** | **Integrity Checks**: The server re-calculates the SHA-256 of incoming bytes. If it doesn't match the ID claimed by the client, the chunk is rejected. |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Java 21, Spring Boot 3.4 |
| **Frontend** | React.js, Tailwind CSS 3 |
| **Database** | PostgreSQL 15 (Metadata) |
| **Object Storage** | MinIO (S3 Compatible) |
| **Build Tools** | Maven, Docker & Docker Compose |

---

## ⚡ How to Run

### Prerequisites

- Docker & Docker Compose
- Java 21 SDK
- Node.js (for Frontend)

### 1. Start Infrastructure

Run the database and storage containers:

```bash
docker-compose up -d
```

- **MinIO Console**: http://localhost:9001 (User: `minioadmin`, Pass: `minioadmin`)

### 2. Start Backend

Navigate to the backend folder and run the Spring Boot app:

```bash
cd backend
mvn clean install
java -jar target/MiniDrive-1.0-SNAPSHOT.jar
```

Server starts on http://localhost:8080

### 3. Start Frontend

Navigate to the frontend folder:

```bash
cd frontend
npm install
npm start
```

UI opens at http://localhost:3000

---

## 📸 Screenshots