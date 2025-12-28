import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from './api';

// Hooks & Utils
import useDriveContent from './hooks/useDriveContent';
import { calculateHash } from './utils/helpers';

// Components
import Sidebar from './components/sidebar/Sidebar';
import Header from './components/ui/Header';
import AnimatedBackground from './components/ui/AnimatedBackground';
import UploadProgress from './components/ui/UploadProgress';
import Breadcrumbs from './components/drive/Breadcrumbs';
import FileGrid from './components/drive/FileGrid';
import ContextMenu from './components/drive/ContextMenu';

// Modals
import CreateFolderModal from './components/modals/CreateFolderModal';
import PreviewModal from './components/modals/PreviewModal';
import InfoModal from './components/modals/InfoModal';

const Dashboard = () => {
  // --- State Management ---
  const [currentView, setCurrentView] = useState('drive');
  const [currentFolder, setCurrentFolder] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: null, name: 'My Drive' }]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("date");

  // UI Interactions
  const [menuPos, setMenuPos] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'createFolder', 'preview', 'info', 'profile'
  const [selectedItem, setSelectedItem] = useState(null);

  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const user = localStorage.getItem('user');

  // Custom Hook for Data
  const { content, stats, refresh, refreshStats } = useDriveContent(currentView, currentFolder, searchQuery);

  // --- Global Click Listener (Close Context Menu) ---
  useEffect(() => {
    const handleClick = () => setMenuPos(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // --- Action Handlers ---
  const handleAction = async (action, item) => {
    setMenuPos(null);
    try {
      switch(action) {
        case 'open':
          if (item.type === 'folder' || !item.size) { // Folder check
            setCurrentFolder(item.id);
            setBreadcrumbs(prev => [...prev, { id: item.id, name: item.name }]);
          } else {
            setSelectedItem(item);
            setActiveModal('preview');
          }
          break;
        case 'preview':
          setSelectedItem(item);
          setActiveModal('preview');
          break;
        case 'info':
          setSelectedItem(item);
          setActiveModal('info');
          break;
        case 'download':
          const res = await api.get(`/drive/download/${item.name}`, { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([res.data]));
          const link = document.createElement('a'); link.href = url; link.download = item.name;
          document.body.appendChild(link); link.click(); link.remove();
          break;
        case 'share':
          const shareRes = await api.post(`/drive/share/${item.id}`);
          navigator.clipboard.writeText(`http://localhost:8080/api/public/share/${shareRes.data}`);
          toast.success("Public link copied!");
          break;
        case 'star':
          await api.post('/drive/action/star', { id: item.id, type: item.type || 'file', value: !item.starred });
          refresh();
          break;
        case 'trash':
        case 'restore':
          await api.post('/drive/action/trash', { id: item.id, type: item.type || 'file', value: action === 'trash' });
          toast.success(action === 'trash' ? "Moved to Trash" : "Restored");
          refresh();
          break;
        case 'permanentDelete':
          if (window.confirm("Delete forever? This cannot be undone.")) {
            await api.delete(`/drive/${item.id}/permanent`);
            toast.success("Deleted permanently");
            refresh();
            refreshStats();
          }
          break;
        default: break;
      }
    } catch (err) {
      console.error(err);
      toast.error("Action failed");
    }
  };

  const handleCreateFolder = async (name) => {
    try {
      await api.post('/drive/folders', { name, parentId: currentFolder });
      setActiveModal(null);
      refresh();
    } catch (err) { toast.error("Failed to create folder"); }
  };

  const handleUpload = async (file) => {
    setProgress(1);
    const CHUNK_SIZE = 1024 * 1024;
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
      refresh(); refreshStats();
      setTimeout(() => setProgress(0), 1000);
      toast.success("Uploaded successfully");
    } catch (error) {
      toast.error("Upload Failed");
      setProgress(0);
    }
  };

  // --- Render ---
  return (
      <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden relative selection:bg-indigo-500/30">
        <AnimatedBackground />

        <input type="file" ref={fileInputRef} onChange={(e) => Array.from(e.target.files).forEach(handleUpload)} className="hidden" multiple />

        {/* Context Menu */}
        <AnimatePresence>
          {menuPos && (
              <ContextMenu {...menuPos} onClose={() => setMenuPos(null)} onAction={handleAction} isTrashView={currentView === 'trash'} />
          )}
        </AnimatePresence>

        <Sidebar
            currentView={currentView} setCurrentView={setCurrentView}
            setCurrentFolder={setCurrentFolder} setBreadcrumbs={setBreadcrumbs}
            stats={stats} onUpload={() => fileInputRef.current.click()}
            onCreateFolder={() => setActiveModal('createFolder')}
        />

        {/* Main Content Area */}
        <main
            className="flex-1 flex flex-col relative z-10 m-4 rounded-3xl bg-white/40 border border-white/20 shadow-xl backdrop-blur-sm overflow-hidden"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); Array.from(e.dataTransfer.files).forEach(handleUpload); }}
        >
          {/* Drag Overlay */}
          <AnimatePresence>
            {isDragging && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-indigo-500/10 backdrop-blur-sm border-4 border-dashed border-indigo-500 rounded-3xl flex items-center justify-center pointer-events-none">
                  <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center animate-bounce">
                    <p className="font-bold text-lg text-indigo-700">Drop files to upload</p>
                  </div>
                </motion.div>
            )}
          </AnimatePresence>

          <Header
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              sortBy={sortBy} setSortBy={setSortBy}
              viewMode={viewMode} setViewMode={setViewMode}
              user={user} onProfileClick={() => { localStorage.clear(); navigate('/login'); }}
          />

          {currentView === 'drive' && !searchQuery && (
              <Breadcrumbs
                  breadcrumbs={breadcrumbs}
                  onNavigate={(idx) => {
                    const target = breadcrumbs[idx];
                    setCurrentFolder(target.id);
                    setBreadcrumbs(prev => prev.slice(0, idx + 1));
                  }}
              />
          )}

          <FileGrid
              folders={content.folders} files={content.files}
              viewMode={viewMode} sortBy={sortBy}
              onNavigate={(item) => handleAction('open', item)}
              onAction={handleAction}
              onMove={async (itemId, type, targetId) => {
                await api.post('/drive/action/move', { id: itemId, type, targetId });
                refresh(); toast.success("Moved");
              }}
              onContextMenu={(e, item, type) => setMenuPos({ x: e.clientX, y: e.clientY, item, type })}
              isTrashView={currentView === 'trash'}
          />
        </main>

        <UploadProgress progress={progress} />

        {/* Modals */}
        <CreateFolderModal isOpen={activeModal === 'createFolder'} onClose={() => setActiveModal(null)} onCreate={handleCreateFolder} />
        <PreviewModal file={activeModal === 'preview' ? selectedItem : null} onClose={() => setActiveModal(null)} onDownload={(f) => handleAction('download', f)} />
        <InfoModal file={activeModal === 'info' ? selectedItem : null} onClose={() => setActiveModal(null)} />
      </div>
  );
};

export default Dashboard;