import React, { useState, useEffect, useRef } from 'react';
import api from './api'; // Use the robust API client we made
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud, File, FileImage, FileVideo, FileText,
  Grid, List as ListIcon, HardDrive, Clock, Star, Trash2,
  Download, ChevronRight, Folder, FolderPlus, X, ChevronDown, RefreshCw, XCircle
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

// --- ITEM CARD COMPONENT ---
const ItemCard = ({ item, type, onAction, onNavigate, isTrashView }) => {
  const isFolder = type === 'folder';
  let Icon = File;
  let color = "bg-gray-50 text-gray-400";

  if (isFolder) { Icon = Folder; color = "bg-indigo-50 text-indigo-500"; }
  else {
    const ext = item.name.split('.').pop().toLowerCase();
    if (['jpg', 'png', 'jpeg'].includes(ext)) { color = "bg-purple-100 text-purple-600"; Icon = FileImage; }
    if (['mp4', 'mkv', 'mov'].includes(ext)) { color = "bg-red-100 text-red-600"; Icon = FileVideo; }
    if (['pdf', 'doc', 'txt'].includes(ext)) { color = "bg-blue-100 text-blue-600"; Icon = FileText; }
  }

  return (
      <motion.div
          layout
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          onDoubleClick={() => isFolder && !isTrashView && onNavigate(item)}
          className="group relative bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between h-48 select-none"
      >
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {isTrashView ? (
              <>
                <button onClick={(e) => { e.stopPropagation(); onAction('restore', item); }} className="p-1.5 hover:bg-green-50 text-slate-400 hover:text-green-600 rounded-full"><RefreshCw size={16} /></button>
                <button onClick={(e) => { e.stopPropagation(); onAction('permanentDelete', item); }} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-full"><XCircle size={16} /></button>
              </>
          ) : (
              <>
                {!isFolder && <button onClick={(e) => { e.stopPropagation(); onAction('download', item); }} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500"><Download size={16} /></button>}
                <button onClick={(e) => { e.stopPropagation(); onAction('star', item); }} className={`p-1.5 hover:bg-yellow-50 rounded-full ${item.starred ? 'text-yellow-500 fill-yellow-500' : 'text-slate-400 hover:text-yellow-500'}`}><Star size={16} fill={item.starred ? "currentColor" : "none"} /></button>
                <button onClick={(e) => { e.stopPropagation(); onAction('trash', item); }} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full"><Trash2 size={16} /></button>
              </>
          )}
        </div>

        <div className={`flex-1 flex items-center justify-center rounded-xl mb-4 ${color}`}>
          <Icon size={40} fill={isFolder ? "currentColor" : "none"} />
        </div>
        <div>
          <h3 className="font-semibold text-slate-700 text-sm truncate" title={item.name}>{item.name}</h3>
          <p className="text-xs text-slate-400 mt-1">{isFolder ? "Folder" : formatBytes(item.size)} • {new Date(item.date).toLocaleDateString()}</p>
        </div>
      </motion.div>
  );
};

// --- DASHBOARD COMPONENT ---
const Dashboard = () => {
  const [content, setContent] = useState({ folders: [], files: [] });
  const [currentView, setCurrentView] = useState('drive');
  const [currentFolder, setCurrentFolder] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: null, name: 'My Drive' }]);

  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("date");

  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const username = localStorage.getItem('user') || "User";
  const CHUNK_SIZE = 1024 * 1024;

  useEffect(() => { fetchContent(); }, [currentFolder, currentView]);

  const fetchContent = async () => {
    try {
      let url = `/drive/content`;
      let params = {};
      if (currentView === 'drive') {
        if (currentFolder) params.folderId = currentFolder;
      } else {
        params.filter = currentView;
      }
      const res = await api.get(url, { params });
      setContent(res.data);
    } catch (error) {
      // API interceptor handles redirect
    }
  };

  const handleAction = async (action, item) => {
    const type = item.type;
    try {
      if (action === 'download') {
        const res = await api.get(`/drive/download/${item.name}`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url; link.download = item.name;
        document.body.appendChild(link); link.click(); link.remove();
      }
      else if (action === 'trash' || action === 'restore') {
        await api.post('/drive/action/trash', { id: item.id, type, value: action === 'trash' });
        fetchContent();
      }
      else if (action === 'permanentDelete') {
        if (!window.confirm("Permanently delete this item?")) return;
        await api.delete(`/drive/${item.id}/permanent`);
        fetchContent();
      }
      else if (action === 'star') {
        await api.post('/drive/action/star', { id: item.id, type, value: !item.starred });
        fetchContent();
      }
    } catch (err) { console.error(err); }
  };

  const createFolder = async (e) => {
    e.preventDefault();
    try {
      await api.post('/drive/folders', { name: newFolderName, parentId: currentFolder });
      setNewFolderName(""); setShowCreateFolder(false); fetchContent();
    } catch (err) { alert("Failed"); }
  };

  const handleUpload = async (file) => {
    setProgress(1);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    try {
      const formData = new FormData();
      formData.append('filename', file.name);
      formData.append('size', file.size);
      if (currentFolder) formData.append('folderId', currentFolder);

      const initRes = await api.post('/drive/init', formData);
      const uploadId = initRes.data;

      for (let i = 0; i < totalChunks; i++) {
        const chunk = file.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, file.size));
        const chunkData = new FormData();
        chunkData.append('uploadId', uploadId);
        chunkData.append('index', i);
        chunkData.append('hash', await calculateHash(chunk));
        chunkData.append('chunk', chunk);
        await api.post('/drive/upload/chunk', chunkData);
        setProgress(Math.round(((i + 1) / totalChunks) * 100));
      }
      await api.post(`/drive/complete?uploadId=${uploadId}`);
      fetchContent(); setTimeout(() => setProgress(0), 1000);
    } catch (error) { console.error(error); setProgress(0); }
  };

  const getSortedItems = (items) => {
    if (sortBy === 'name') return [...items].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'size') return [...items].sort((a, b) => (b.size || 0) - (a.size || 0));
    return [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const navClass = (view) => `w-full flex items-center gap-3 px-4 py-2 rounded-lg font-medium transition-colors ${currentView === view ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`;

  return (
      <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
        <input type="file" ref={fileInputRef} onChange={(e) => Array.from(e.target.files).forEach(handleUpload)} className="hidden" multiple />

        {/* SIDEBAR */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
          <div className="p-6">
            <div className="flex items-center gap-3 text-indigo-600 mb-8"><div className="p-2 bg-indigo-100 rounded-lg"><HardDrive size={24} /></div><h1 className="text-xl font-bold tracking-tight">MiniDrive</h1></div>
            <button onClick={() => fileInputRef.current.click()} className="w-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all mb-4 active:scale-95"><UploadCloud size={20} /> Upload File</button>
            <button onClick={() => setShowCreateFolder(true)} className="w-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all mb-6 active:scale-95"><FolderPlus size={20} /> New Folder</button>
            <nav className="space-y-1">
              <button onClick={() => { setCurrentView('drive'); setCurrentFolder(null); setBreadcrumbs([{id:null, name:'My Drive'}]); }} className={navClass('drive')}><HardDrive size={18} /> My Drive</button>
              <button onClick={() => setCurrentView('recent')} className={navClass('recent')}><Clock size={18} /> Recent</button>
              <button onClick={() => setCurrentView('starred')} className={navClass('starred')}><Star size={18} /> Starred</button>
              <button onClick={() => setCurrentView('trash')} className={navClass('trash')}><Trash2 size={18} /> Trash</button>
            </nav>
          </div>
          <div className="mt-auto p-6 border-t border-slate-100 cursor-pointer" onClick={() => setShowProfile(true)}>
            <div className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">{username.charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-700 truncate">{username}</p><p className="text-xs text-slate-400">View Profile</p></div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 flex flex-col overflow-hidden relative" onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); Array.from(e.dataTransfer.files).forEach(handleUpload); }}>
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              {currentView !== 'drive' ? <span className="font-bold text-slate-800 capitalize">{currentView}</span> : breadcrumbs.map((crumb, idx) => (
                  <div key={idx} className="flex items-center"><span onClick={() => { setCurrentFolder(crumb.id); setBreadcrumbs(prev => prev.slice(0, idx + 1)); }} className={`cursor-pointer hover:text-indigo-600 ${idx === breadcrumbs.length - 1 ? 'font-bold text-slate-800' : ''}`}>{crumb.name}</span>{idx < breadcrumbs.length - 1 && <ChevronRight size={14} className="mx-2" />}</div>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <div className="relative group">
                <button className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-lg transition-colors">Sort by: <span className="text-indigo-600 capitalize">{sortBy}</span> <ChevronDown size={16} /></button>
                <div className="absolute right-0 top-full mt-2 w-32 bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                  {['date', 'name', 'size'].map(opt => <button key={opt} onClick={() => setSortBy(opt)} className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 first:rounded-t-xl last:rounded-b-xl capitalize">{opt}</button>)}
                </div>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}><Grid size={18} /></button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}><ListIcon size={18} /></button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8">
            {content.folders.length === 0 && content.files.length === 0 ? (
                <div className="text-center py-20"><div className="bg-slate-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4"><UploadCloud size={40} className="text-slate-400" /></div><h3 className="text-lg font-medium text-slate-600">No items found</h3></div>
            ) : (
                <div className={`grid ${viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5' : 'grid-cols-1'} gap-6`}>
                  <AnimatePresence>
                    {getSortedItems(content.folders).map((f) => <ItemCard key={f.id} item={f} type="folder" onAction={handleAction} onNavigate={(f) => { setCurrentFolder(f.id); setBreadcrumbs(prev => [...prev, {id:f.id, name:f.name}]); }} isTrashView={currentView === 'trash'} />)}
                    {getSortedItems(content.files).map((f) => <ItemCard key={f.id} item={f} type="file" onAction={handleAction} isTrashView={currentView === 'trash'} />)}
                  </AnimatePresence>
                </div>
            )}
          </div>

          {/* MODALS */}
          {showCreateFolder && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center"><div className="bg-white p-6 rounded-2xl shadow-xl w-80 animate-fade-in"><h3 className="font-bold text-lg mb-4">New Folder</h3><form onSubmit={createFolder}><input autoFocus type="text" placeholder="Name" className="w-full border border-slate-300 rounded-lg px-4 py-2 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} /><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowCreateFolder(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Create</button></div></form></div></div>}
          {showProfile && <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center"><div className="bg-white p-6 rounded-2xl shadow-2xl w-96 animate-fade-in"><div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-slate-800">Settings</h3><button onClick={() => setShowProfile(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button></div><div className="flex flex-col items-center mb-6"><div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-3xl font-bold mb-3">{username.charAt(0).toUpperCase()}</div><h4 className="font-semibold text-lg">{username}</h4></div><div className="space-y-3"><button onClick={() => { localStorage.clear(); navigate('/login'); }} className="w-full py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium">Sign Out</button></div></div></div>}
          {progress > 0 && <div className="fixed bottom-8 right-8 bg-slate-900 text-white p-4 rounded-xl shadow-2xl flex items-center gap-4 w-80 animate-slide-up z-50"><div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center"><UploadCloud size={20} className="animate-pulse" /></div><div className="flex-1"><div className="flex justify-between mb-1 text-xs font-medium text-slate-300"><span>Uploading...</span><span>{progress}%</span></div><div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden"><div className="bg-indigo-500 h-full" style={{ width: `${progress}%` }}></div></div></div></div>}
        </main>
      </div>
  );
};

export default Dashboard;