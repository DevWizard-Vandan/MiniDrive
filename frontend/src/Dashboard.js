import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, UploadCloud, File, FileImage, FileVideo, FileText,
  Search, Grid, List as ListIcon, HardDrive, Clock, Star, Trash2,
  Download, Settings, User, ChevronDown, CheckCircle, X
} from 'lucide-react';

// --- UTILS ---
async function calculateHash(chunk) {
  const buffer = await chunk.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

const FileCard = ({ file, onDownload, onDelete }) => {
  const ext = file.name.split('.').pop().toLowerCase();
  let color = "bg-gray-50 text-gray-400";
  let Icon = File;

  if (['jpg', 'png', 'jpeg'].includes(ext)) { color = "bg-purple-100 text-purple-600"; Icon = FileImage; }
  if (['mp4', 'mkv', 'mov'].includes(ext)) { color = "bg-red-100 text-red-600"; Icon = FileVideo; }
  if (['pdf', 'doc', 'txt', 'csv'].includes(ext)) { color = "bg-blue-100 text-blue-600"; Icon = FileText; }

  return (
      <div className="group relative bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between h-48 animate-fade-in">
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onDownload(file.name); }} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500" title="Download">
            <Download size={16} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(file.name); }} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full" title="Delete">
            <Trash2 size={16} />
          </button>
        </div>

        <div className={`flex-1 flex items-center justify-center rounded-xl mb-4 ${color}`}>
          <Icon size={40} />
        </div>

        <div>
          <h3 className="font-semibold text-slate-700 text-sm truncate" title={file.name}>{file.name}</h3>
          <p className="text-xs text-slate-400 mt-1">{formatBytes(file.size)} • {new Date(file.date).toLocaleDateString()}</p>
        </div>
      </div>
  );
};

const Dashboard = () => {
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("date"); // date, name, size
  const [showProfile, setShowProfile] = useState(false);

  const fileInputRef = useRef(null); // Reference to hidden input
  const navigate = useNavigate();
  const username = localStorage.getItem('user') || "User";
  const CHUNK_SIZE = 1024 * 1024;

  useEffect(() => { fetchFiles(); }, []);

  const fetchFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:8080/api/drive/files', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUploadedFiles(res.data);
    } catch (error) {
      if (error.response?.status === 403) navigate('/login');
    }
  };

  const handleDelete = async (filename) => {
    if (!window.confirm(`Delete ${filename}?`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:8080/api/drive/${filename}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUploadedFiles(prev => prev.filter(f => f.name !== filename));
    } catch (err) {
      alert("Delete failed");
    }
  };

  const handleDownload = async (filename) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:8080/api/drive/download/${filename}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert("Download failed.");
    }
  };

  const handleUpload = async (file) => {
    setProgress(1);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };

    try {
      const formData = new FormData();
      formData.append('filename', file.name);
      formData.append('size', file.size);
      const initRes = await axios.post('http://localhost:8080/api/drive/init', formData, config);
      const uploadId = initRes.data;

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
        setProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      await axios.post(`http://localhost:8080/api/drive/complete?uploadId=${uploadId}`, {}, config);
      await fetchFiles();
      setTimeout(() => setProgress(0), 1000);

    } catch (error) {
      console.error(error);
      alert("Upload failed");
      setProgress(0);
    }
  };

  const onFileSelect = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => handleUpload(file));
  };

  const getSortedFiles = () => {
    let files = uploadedFiles.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (sortBy === 'name') return files.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'size') return files.sort((a, b) => b.size - a.size);
    return files.sort((a, b) => new Date(b.date) - new Date(a.date)); // Default: Date Desc
  };

  const totalStorage = uploadedFiles.reduce((acc, file) => acc + file.size, 0);

  return (
      <div className="flex h-screen bg-slate-50 font-sans text-slate-800">

        {/* Hidden Input for Button Upload */}
        <input type="file" ref={fileInputRef} onChange={onFileSelect} className="hidden" multiple />

        {/* SIDEBAR */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
          <div className="p-6">
            <div className="flex items-center gap-3 text-indigo-600 mb-8">
              <div className="p-2 bg-indigo-100 rounded-lg"><HardDrive size={24} /></div>
              <h1 className="text-xl font-bold tracking-tight">MiniDrive</h1>
            </div>

            <button
                onClick={() => fileInputRef.current.click()}
                className="w-full bg-white border border-slate-200 shadow-sm hover:shadow-md text-slate-600 font-medium py-3 px-4 rounded-xl flex items-center gap-2 transition-all mb-6 active:scale-95"
            >
              <div className="p-1 bg-indigo-50 text-indigo-600 rounded"><UploadCloud size={18} /></div>
              <span>Upload New</span>
            </button>

            <nav className="space-y-1">
              <button className="w-full flex items-center gap-3 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-medium"><HardDrive size={18} /> My Drive</button>
              <button className="w-full flex items-center gap-3 px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg font-medium"><Clock size={18} /> Recent</button>
              <button className="w-full flex items-center gap-3 px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg font-medium"><Star size={18} /> Starred</button>
              <button className="w-full flex items-center gap-3 px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg font-medium"><Trash2 size={18} /> Trash</button>
            </nav>
          </div>

          <div className="mt-auto p-6 border-t border-slate-100">
            <div className="mb-2 flex justify-between text-xs font-medium text-slate-500">
              <span>Storage Used</span>
              <span>{formatBytes(totalStorage)} / 1 GB</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
              <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${Math.min((totalStorage / 1073741824) * 100, 100)}%` }}></div>
            </div>
            <div
                onClick={() => setShowProfile(true)}
                className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
            >
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{username}</p>
                <p className="text-xs text-slate-400">View Profile</p>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col overflow-hidden relative"
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                Array.from(e.dataTransfer.files).forEach(handleUpload);
              }}
        >
          {/* Profile Modal */}
          {showProfile && (
              <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-white p-6 rounded-2xl shadow-2xl w-96 animate-fade-in">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800">Profile Settings</h3>
                    <button onClick={() => setShowProfile(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                  </div>
                  <div className="flex flex-col items-center mb-6">
                    <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-3xl font-bold mb-3">
                      {username.charAt(0).toUpperCase()}
                    </div>
                    <h4 className="font-semibold text-lg">{username}</h4>
                    <p className="text-slate-400 text-sm">Standard Plan</p>
                  </div>
                  <div className="space-y-3">
                    <button className="w-full py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-sm font-medium">Change Password</button>
                    <button onClick={() => { localStorage.clear(); navigate('/login'); }} className="w-full py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium">Sign Out</button>
                  </div>
                </div>
              </div>
          )}

          {/* Drag Overlay */}
          {isDragging && (
              <div className="absolute inset-0 bg-indigo-500/10 backdrop-blur-sm z-40 flex items-center justify-center border-4 border-indigo-500 border-dashed m-4 rounded-3xl pointer-events-none">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
                  <UploadCloud size={64} className="mx-auto text-indigo-500 mb-4 animate-bounce" />
                  <h3 className="text-2xl font-bold text-slate-700">Drop to upload</h3>
                </div>
              </div>
          )}

          {/* Header */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
            <div className="flex-1 max-w-2xl relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={20} />
              <input
                  type="text" placeholder="Search files..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 rounded-xl transition-all outline-none"
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4 ml-4">
              {/* Sort Dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-lg transition-colors">
                  Sort by: <span className="text-indigo-600 capitalize">{sortBy}</span> <ChevronDown size={16} />
                </button>
                <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                  {['date', 'name', 'size'].map(opt => (
                      <button key={opt} onClick={() => setSortBy(opt)} className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 first:rounded-t-xl last:rounded-b-xl capitalize">
                        {opt}
                      </button>
                  ))}
                </div>
              </div>
            </div>
          </header>

          {/* Files Area */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">My Files</h2>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}><Grid size={18} /></button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}><ListIcon size={18} /></button>
              </div>
            </div>

            {/* Grid/List View */}
            {getSortedFiles().length === 0 ? (
                <div className="text-center py-20">
                  <div className="bg-slate-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UploadCloud size={40} className="text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-600">No files found</h3>
                  <p className="text-slate-400 mt-1">Upload a file to get started</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {getSortedFiles().map((file, idx) => (
                      <FileCard key={idx} file={file} onDownload={handleDownload} onDelete={handleDelete} />
                  ))}
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-medium">
                    <tr>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Size</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {getSortedFiles().map((file, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4 flex items-center gap-3">
                            <File className="text-slate-400" size={18} />
                            <span className="font-medium text-slate-700">{file.name}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-sm">{formatBytes(file.size)}</td>
                          <td className="px-6 py-4 text-slate-500 text-sm">{new Date(file.date).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-right flex justify-end gap-2">
                            <button onClick={() => handleDownload(file.name)} className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg"><Download size={18} /></button>
                            <button onClick={() => handleDelete(file.name)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={18} /></button>
                          </td>
                        </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
            )}
          </div>

          {/* Upload Progress Toast */}
          {progress > 0 && (
              <div className="fixed bottom-8 right-8 bg-slate-900 text-white p-4 rounded-xl shadow-2xl flex items-center gap-4 w-80 animate-slide-up z-50">
                <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center"><UploadCloud size={20} className="animate-pulse" /></div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1 text-xs font-medium text-slate-300">
                    <span>Uploading...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full transition-all duration-200" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              </div>
          )}
        </main>
      </div>
  );
};

export default Dashboard;