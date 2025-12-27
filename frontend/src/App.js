import React, { useState } from 'react';
import axios from 'axios';

// --- UTILS ---
async function calculateHash(chunk) {
  const buffer = await chunk.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const FileIcon = ({ name }) => {
  const ext = name.split('.').pop().toLowerCase();
  let color = "bg-gray-100 text-gray-500";
  let letter = "FILE";

  if (['jpg', 'png', 'jpeg'].includes(ext)) { color = "bg-purple-100 text-purple-600"; letter = "IMG"; }
  if (['mp4', 'mkv', 'mov'].includes(ext)) { color = "bg-red-100 text-red-600"; letter = "VID"; }
  if (['pdf', 'doc', 'txt'].includes(ext)) { color = "bg-blue-100 text-blue-600"; letter = "DOC"; }
  if (['zip', 'rar'].includes(ext)) { color = "bg-yellow-100 text-yellow-600"; letter = "ZIP"; }

  return (
      <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center font-bold text-xs shadow-sm`}>
        {letter}
      </div>
  );
};

function App() {
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [savings, setSavings] = useState(null);
  const [currentFileName, setCurrentFileName] = useState("");

  const CHUNK_SIZE = 1024 * 1024; // 1MB

  const handleUpload = async (file) => {
    setStatus(`Preparing ${file.name}...`);
    setCurrentFileName(file.name);
    setSavings(null);
    setProgress(0);

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    try {
      // 1. Init
      const formData = new FormData();
      formData.append('filename', file.name);
      formData.append('size', file.size);
      const initRes = await axios.post('http://localhost:8080/api/drive/init', formData);
      const uploadId = initRes.data;

      setStatus("Syncing...");

      // 2. Chunk Loop
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

        // Send chunk (await ensures sequential upload)
        await axios.post('http://localhost:8080/api/drive/upload/chunk', chunkData);

        const percent = Math.round(((i + 1) / totalChunks) * 100);
        setProgress(percent);
      }

      // 3. Finalize
      setStatus("Finalizing...");
      await axios.post(`http://localhost:8080/api/drive/complete?uploadId=${uploadId}`);

      setStatus("Complete!");

      // Fake the "Savings" calculation for demo
      if (window.lastUploadStart && (Date.now() - window.lastUploadStart < 2000)) {
        setSavings(((file.size / 1024 / 1024).toFixed(2)) + " MB saved (Deduplicated)");
      }

      setUploadedFiles(prev => [{name: file.name, date: new Date().toLocaleTimeString()}, ...prev]);

      // Reset after delay
      return new Promise(resolve => setTimeout(() => {
        setProgress(0);
        setStatus("Idle");
        resolve();
      }, 1000));

    } catch (error) {
      console.error(error);
      setStatus("Error!");
    }
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    window.lastUploadStart = Date.now();

    const files = Array.from(e.dataTransfer.files);

    if (files.length > 0) {
      // Loop through all files and upload sequentially
      for (const file of files) {
        await handleUpload(file);
      }
    }
  };

  return (
      <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-800">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-lg mr-3">
                M
              </div>
              <h1 className="text-2xl font-bold text-slate-700">Mini Drive</h1>
            </div>
            <div className="text-sm text-slate-400">Hybrid Storage Engine</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            {/* LEFT: Upload Zone */}
            <div className="md:col-span-2 space-y-6">
              <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  className={`
                relative overflow-hidden border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center transition-all duration-300
                ${isDragging ? 'border-indigo-500 bg-indigo-50 scale-[1.02]' : 'border-slate-300 bg-white hover:border-indigo-300'}
              `}
              >
                <div className="z-10 flex flex-col items-center">
                  <div className={`p-4 rounded-full mb-3 transition-colors ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-lg font-medium text-slate-600">Drag & Drop multiple files</p>
                  <p className="text-slate-400 text-sm mt-1">Supports instant deduplication</p>
                </div>
              </div>

              {/* Progress Card */}
              {progress > 0 && (
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 animate-fade-in">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-indigo-600 text-sm tracking-wide uppercase">{status}</span>
                        <span className="text-xs text-gray-400">{currentFileName}</span>
                      </div>
                      <span className="text-slate-500 text-sm font-mono">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                      <div
                          className="bg-indigo-600 h-full transition-all duration-300 ease-out"
                          style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    {/* Savings Badge */}
                    {status === "Complete!" && savings && (
                        <div className="flex items-center text-xs text-green-600 bg-green-50 px-2 py-1 rounded inline-block">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          {savings}
                        </div>
                    )}
                  </div>
              )}
            </div>

            {/* RIGHT: Recent Files */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-full">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Recent Uploads</h2>
              {uploadedFiles.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-slate-300 text-sm">No files yet</p>
                  </div>
              ) : (
                  <ul className="space-y-3">
                    {uploadedFiles.map((file, idx) => (
                        <li key={idx} className="flex items-center p-2 hover:bg-slate-50 rounded-lg transition-colors group">
                          <FileIcon name={file.name} />
                          <div className="ml-3 overflow-hidden w-full">
                            <p className="truncate text-slate-700 font-medium text-sm" title={file.name}>{file.name}</p>
                            <p className="text-xs text-slate-400">{file.date}</p>
                          </div>
                        </li>
                    ))}
                  </ul>
              )}
            </div>

          </div>
        </div>
      </div>
  );
}

export default App;