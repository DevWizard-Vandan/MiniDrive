import React, { useState, useCallback } from 'react';
import axios from 'axios';

// Simple Hash function for the browser (SHA-256)
async function calculateHash(chunk) {
  const buffer = await chunk.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const DriveUpload = () => {
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState("Ready");

  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

  const handleUpload = async (file) => {
    setStatus("Initiating...");
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // 1. Tell Server we are starting
    const formData = new FormData();
    formData.append('filename', file.name);
    formData.append('size', file.size);
    
    // Call our Java REST API
    const initRes = await axios.post('http://localhost:8080/api/drive/init', formData);
    const uploadId = initRes.data; // Server gives us an ID

    setStatus("Uploading...");
    
    // 2. Loop through chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      const hash = await calculateHash(chunk);
      
      const chunkData = new FormData();
      chunkData.append('uploadId', uploadId);
      chunkData.append('index', i);
      chunkData.append('hash', hash);
      chunkData.append('chunk', chunk);

      // Upload Chunk
      await axios.post('http://localhost:8080/api/drive/upload/chunk', chunkData);

      // Update Progress Bar
      const percent = Math.round(((i + 1) / totalChunks) * 100);
      setProgress(percent);
    }
    
    setStatus("Upload Complete!");
    setProgress(100);
  };

  // Drag & Drop Handlers
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) handleUpload(files[0]);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100 font-sans">
      
      {/* The "Google Drive" Card */}
      <div className="w-96 bg-white rounded-xl shadow-lg p-6">
        
        {/* Header */}
        <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl mr-3">
              D
            </div>
            <h1 className="text-xl font-semibold text-gray-700">Mini Drive</h1>
        </div>

        {/* Drop Zone */}
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`
            border-2 border-dashed rounded-lg h-48 flex flex-col items-center justify-center transition-colors
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}
          `}
        >
          <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-gray-500 text-sm">Drag & Drop your file here</p>
        </div>

        {/* Progress Section */}
        {progress > 0 && (
          <div className="mt-6">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{status}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DriveUpload;