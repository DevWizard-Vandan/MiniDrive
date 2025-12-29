import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from './api';

// Hooks & Context
import { useDriveContent } from './hooks/useDriveContent';
import { useAuth } from './context/AuthContext';

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
  // 1. Logic Hook
  const {
    content, stats, progress,
    currentView, setCurrentView,
    currentFolder, setCurrentFolder,
    breadcrumbs, setBreadcrumbs,
    fetchContent, handleUpload, handleCreateFolder, handleMoveItem, deleteItem
  } = useDriveContent();

  // 2. Auth Context
  const { user } = useAuth();

  // 3. Local UI State
  const [menuPos, setMenuPos] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // Header State
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("date");

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Close Context Menu on Global Click
  useEffect(() => {
    const handleClick = () => setMenuPos(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Search Logic
  useEffect(() => {
    fetchContent(searchQuery);
  }, [searchQuery, fetchContent]);

  const handleAction = async (action, item) => {
    setMenuPos(null);
    if(action === 'open') {
      if(item.type === 'folder') {
        setCurrentFolder(item.id);
        setBreadcrumbs(prev => [...prev, { id: item.id, name: item.name }]);
      } else {
        setSelectedItem(item); setActiveModal('preview');
      }
    }
    else if(action === 'preview') { setSelectedItem(item); setActiveModal('preview'); }
    else if(action === 'info') { setSelectedItem(item); setActiveModal('info'); }
    else if(action === 'download') {
      const res = await api.get(`/drive/download/${item.name}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url; link.download = item.name;
      document.body.appendChild(link); link.click(); link.remove();
    }
    else if(action === 'share') {
      const res = await api.post(`/drive/share/${item.id}`);
      navigator.clipboard.writeText(`http://localhost:8080/api/public/share/${res.data}`);
      toast.success("Public link copied!");
    }
    else if(action === 'star') {
      await api.post('/drive/action/star', { id: item.id, type: item.type || 'file', value: !item.starred });
      fetchContent();
    }
    else if(action === 'trash' || action === 'restore') {
      deleteItem(item.id, false);
    }
    else if(action === 'permanentDelete') {
      if(window.confirm("Delete forever?")) deleteItem(item.id, true);
    }
  };

  return (
      <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden relative selection:bg-indigo-500/30">
        <AnimatedBackground />
        <input type="file" ref={fileInputRef} onChange={(e) => handleUpload(e.target.files)} className="hidden" multiple />

        <AnimatePresence>
          {menuPos && <ContextMenu {...menuPos} onClose={() => setMenuPos(null)} onAction={handleAction} isTrashView={currentView === 'trash'} />}
        </AnimatePresence>

        <Sidebar
            currentView={currentView} setCurrentView={setCurrentView}
            setCurrentFolder={setCurrentFolder} setBreadcrumbs={setBreadcrumbs}
            stats={stats} onUpload={() => fileInputRef.current.click()}
            onCreateFolder={() => setActiveModal('createFolder')}
        />

        <main
            className="flex-1 flex flex-col relative z-10 m-4 rounded-3xl bg-white/40 border border-white/20 shadow-xl backdrop-blur-sm overflow-hidden"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleUpload(e.dataTransfer.files); }}
        >
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
              items={[...(content.folders || []), ...(content.files || [])]}
              viewMode={viewMode}
              sortBy={sortBy}
              onNavigate={(item) => handleAction('open', item)}
              onAction={handleAction}
              onMove={handleMoveItem}
              onContextMenu={(e, item, type) => setMenuPos({ x: e.clientX, y: e.clientY, item, type })}
              isTrashView={currentView === 'trash'}
          />
        </main>

        <UploadProgress progress={progress} />

        <CreateFolderModal isOpen={activeModal === 'createFolder'} onClose={() => setActiveModal(null)} onCreate={(name) => { handleCreateFolder(name); setActiveModal(null); }} />
        <PreviewModal file={activeModal === 'preview' ? selectedItem : null} onClose={() => setActiveModal(null)} onDownload={(f) => handleAction('download', f)} />
        <InfoModal file={activeModal === 'info' ? selectedItem : null} onClose={() => setActiveModal(null)} breadcrumbs={breadcrumbs} />
      </div>
  );
};

export default Dashboard;