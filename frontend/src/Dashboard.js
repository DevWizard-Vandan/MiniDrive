import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { LogOut, UploadCloud, File, FileImage, FileVideo, FileText, CheckCircle, Download } from 'lucide-react';
// --- UTILS ---
async function calculateHash(chunk) {
  const buffer = await chunk.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const FileIcon = ({ name }) => {
  const ext = name.split('.').pop().toLowerCase();
  if (['jpg', 'png', 'jpeg'].includes(ext)) return <FileImage className="text-purple-500" />;
  if (['mp4', 'mkv', 'mov'].includes(ext)) return <FileVideo className="text-red-500" />;
  if (['pdf', 'doc', 'txt'].includes(ext)) return <FileText className="text-blue-500" />;
  return <File className="text-gray-400" />;
};

const Dashboard = () => {
  // 1. State Hooks (Must be at top)
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [savings, setSavings] = useState(null);

  const navigate = useNavigate();
  const username = localStorage.getItem('user') || "User";
  const CHUNK_SIZE = 1024 * 1024; // 1MB

  const handleDownload = async (filename) => {
    try {
      const token = localStorage.getItem('token');
      // We must fetch the blob with Auth headers
      const response = await axios.get(`http://localhost:8080/api/drive/download/${filename}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob', // Important: Treat response as a file
      });

      // Create a hidden link to force download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Download failed", error);
      alert("Failed to download file.");
    }
  };

  // 2. Fetch Files Function (Moved up so it can be used anywhere)
  const fetchFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      // Fix: Ensure we don't fetch if no token
      if (!token) return;

      const res = await axios.get('http://localhost:8080/api/drive/files', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Convert backend timestamp to readable date
      const formattedFiles = res.data.map(f => ({
        ...f,
        date: new Date(f.date).toLocaleString()
      }));
      setUploadedFiles(formattedFiles);
    } catch (error) {
      console.error("Failed to fetch files", error);
    }
  };

  // 3. useEffect Hook (Run once on load)
  useEffect(() => {
    fetchFiles();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleUpload = async (file) => {
    setStatus(`Preparing ${file.name}...`);
    setSavings(null);
    setProgress(0);

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // Auth Header
    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };

    try {
      // A. Init Upload
      const formData = new FormData();
      formData.append('filename', file.name);
      formData.append('size', file.size);
      const initRes = await axios.post('http://localhost:8080/api/drive/init', formData, config);
      const uploadId = initRes.data;

      setStatus("Syncing...");

      // B. Chunk Loop
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

        await axios.post('http://localhost:8080/api/drive/upload/chunk', chunkData, config);

        const percent = Math.round(((i + 1) / totalChunks) * 100);
        setProgress(percent);
      }

      // C. Finalize
      setStatus("Finalizing...");
      await axios.post(`http://localhost:8080/api/drive/complete?uploadId=${uploadId}`, {}, config);

      setStatus("Complete!");

      if (window.lastUploadStart && (Date.now() - window.lastUploadStart < 2000)) {
        setSavings(((file.size / 1024 / 1024).toFixed(2)) + " MB saved (Deduplicated)");
      }

      // REFRESH FILE LIST FROM SERVER
      await fetchFiles();

      return new Promise(resolve => setTimeout(() => {
        setProgress(0);
        setStatus("Idle");
        resolve();
      }, 1000));

    } catch (error) {
      console.error(error);
      if (error.response && error.response.status === 403) {
        alert("Session expired. Please login again.");
        handleLogout();
      }
      setStatus("Error!");
    }
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    window.lastUploadStart = Date.now();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      for (const file of files) await handleUpload(file);
    }
  };

  return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800">

        {/* Navbar */}
        <nav className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-md mr-3">M</div>
            <h1 className="text-xl font-bold text-slate-700">Mini Drive</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-500 text-sm">Hello, <b>{username}</b></span>
            <button onClick={handleLogout} className="flex items-center text-slate-500 hover:text-red-500 transition-colors">
              <LogOut size={18} className="mr-1" /> Logout
            </button>
          </div>
        </nav>

        <div className="max-w-5xl mx-auto p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            {/* Upload Zone */}
            <div className="md:col-span-2 space-y-6">
              <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  className={`
                relative overflow-hidden border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center transition-all duration-300 bg-white
                ${isDragging ? 'border-indigo-500 bg-indigo-50 scale-[1.01]' : 'border-slate-300 hover:border-indigo-300'}
              `}
              >
                <div className="z-10 flex flex-col items-center pointer-events-none">
                  <div className={`p-4 rounded-full mb-3 transition-colors ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                    <UploadCloud size={32} />
                  </div>
                  <p className="text-lg font-medium text-slate-600">Drag & Drop files</p>
                  <p className="text-slate-400 text-sm mt-1">Multi-file upload supported</p>
                </div>
              </div>

              {/* Progress Bar */}
              {progress > 0 && (
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 animate-fade-in">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-indigo-600 text-sm tracking-wide uppercase">{status}</span>
                      <span className="text-slate-500 text-sm font-mono">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                      <div className="bg-indigo-600 h-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                    </div>
                    {savings && (
                        <div className="flex items-center text-xs text-green-600 bg-green-50 px-2 py-1 rounded inline-block">
                          <CheckCircle size={12} className="mr-1" /> {savings}
                        </div>
                    )}
                  </div>
              )}
            </div>

            {/* Recent Files */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-full min-h-[300px]">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">My Files</h2>
              {uploadedFiles.length === 0 ? (
                  <div className="text-center py-10 opacity-50">
                    <File size={40} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-slate-300 text-sm">No files uploaded yet</p>
                  </div>
              ) : (
                  <ul className="space-y-3">
                    {uploadedFiles.map((file, idx) => (
                        <li key={idx}
                            className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100 group">
                          <div className="flex items-center overflow-hidden">
                            <FileIcon name={file.name}/>
                            <div className="ml-3 overflow-hidden">
                              <p className="truncate text-slate-700 font-medium text-sm w-40"
                                 title={file.name}>{file.name}</p>
                              <p className="text-xs text-slate-400">{file.date}</p>
                            </div>
                          </div>

                          {/* Download Button (Only shows on hover) */}
                          <button
                              onClick={() => handleDownload(file.name)}
                              className="text-slate-300 hover:text-indigo-600 transition-colors p-2"
                              title="Download"
                          >
                            <Download size={18}/>
                          </button>
                        </li>
                    ))}
                  </ul>
              )}
            </div>

          </div>
        </div>
      </div>
  );
};

export default Dashboard;