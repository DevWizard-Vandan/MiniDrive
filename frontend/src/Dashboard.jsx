import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useDriveContent } from './hooks/useDriveContent';
import { useKeyboardShortcuts, createDriveShortcuts } from './hooks/useKeyboardShortcuts';
import Sidebar from './components/sidebar/Sidebar';
import Navbar from './components/navbar/Navbar';
import FileGrid from './components/drive/FileGrid';
import ContextMenu from './components/drive/ContextMenu';
import ActivityLog from './components/drive/ActivityLog';
import ShareModal from './components/modals/ShareModal';
import SettingsModal from './components/modals/SettingsModal';
import ProfileModal from './components/modals/ProfileModal';
import PreviewModal from './components/modals/PreviewModal';
import VaultPasswordModal from './components/modals/VaultPasswordModal';
import ChatWithDrive from './components/memory/ChatWithDrive';
import GraphView from './components/memory/GraphView';
import useVaultUpload from './hooks/useVaultUpload';
import { getVaultPassword, hasVaultPassword } from './utils/VaultCrypto';
import toast from 'react-hot-toast';
import api from './api';
import { Home, ChevronRight, LayoutGrid, List, Upload, Lock, UploadCloud } from 'lucide-react';

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
};

const Dashboard = () => {
  const {
    content,
    stats,
    progress,
    currentView,
    setCurrentView,
    currentFolder,
    setCurrentFolder,
    breadcrumbs,
    setBreadcrumbs,
    fetchContent,
    handleUpload,
    handleCreateFolder,
    deleteItem,
    restoreItem,
    toggleStar,
    toggleVault
  } = useDriveContent();

  const [menu, setMenu] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('date');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Modal States
  const [shareModalItem, setShareModalItem] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  // Vault States
  const [isVaultPasswordModalOpen, setIsVaultPasswordModalOpen] = useState(false);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(() => !!getVaultPassword());
  const [vaultPasswordMode, setVaultPasswordMode] = useState('unlock');
  const vaultFileInputRef = useRef(null);

  // Vault Upload Hook - pass fetchContent to refresh after vault upload
  const { uploadToVault, uploading: vaultUploading, progress: vaultProgress } = useVaultUpload(fetchContent);

  // Keyboard Shortcuts
  useKeyboardShortcuts(createDriveShortcuts({
    onUpload: () => fileInputRef.current?.click(),
    onDelete: () => { /* TODO */ },
    onDownload: () => { /* TODO */ },
    onNewFolder: () => {
      const name = prompt("Enter folder name:");
      if (name) handleCreateFolder(name, currentView === 'vault');
    },
    onSearch: () => document.querySelector('input[type="text"]')?.focus(),
    onEscape: () => {
      setShareModalItem(null);
      setIsSettingsOpen(false);
      setIsProfileOpen(false);
      setPreviewFile(null);
      setMenu(null);
    },
    onSelectAll: () => { /* TODO */ }
  }));

  // --- VAULT LOCK HANDLER ---
  const handleLockVault = () => {
    sessionStorage.removeItem('vaultPassword');
    setIsVaultUnlocked(false);
    if (currentView === 'vault') {
      setCurrentView('drive');
      setCurrentFolder(null);
      setBreadcrumbs([{ id: null, name: 'My Drive' }]);
    }
    toast.success('Vault locked', { icon: '🔒' });
  };

  // --- FILE UPLOAD HANDLERS ---
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files?.length > 0) {
      handleUpload(e.target.files);
      e.target.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files?.length > 0) {
      handleUpload(files);
    }
  };

  // --- DOWNLOAD HELPER ---
  const handleDownload = async (item) => {
    if (item.type === 'folder') {
      const toastId = toast.loading("Zipping folder...");
      try {
        const res = await api.get(`/drive/download/folder/${item.id}`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${item.name}.zip`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success("Download started", { id: toastId });
      } catch (err) {
        toast.error("Download failed or folder empty", { id: toastId });
      }
    } else {
      try {
        const res = await api.get(`/drive/download/${item.name}`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (e) { toast.error("Download failed"); }
    }
  };

  // --- MOVE HANDLER ---
  const handleMove = async (draggedId, draggedType, targetFolderId) => {
    // Prevent moving into itself (though backend should handle it, good UX to check)
    if (draggedId === targetFolderId) return;

    try {
      await api.post('/drive/action/move', {
        id: draggedId,
        type: draggedType,
        targetId: targetFolderId
      });
      toast.success("Moved item");
      fetchContent();
    } catch (e) {
      toast.error("Failed to move item");
    }
  };

  // --- ACTIONS HANDLER ---
  const handleAction = async (action, item) => {
    switch (action) {
      case 'open':
        if (item.type === 'folder') {
          setCurrentFolder(item.id);
          setBreadcrumbs([...breadcrumbs, { id: item.id, name: item.name }]);
        }
        break;

      case 'preview':
        // Open preview modal for files
        setPreviewFile({ ...item, type: 'file' });
        break;

      case 'download':
        await handleDownload(item);
        break;

      case 'trash':
        await deleteItem(item, false);
        break;

      case 'permanentDelete':
        await deleteItem(item, true);
        break;

      case 'restore':
        await restoreItem(item);
        break;

      case 'star':
        await toggleStar(item);
        break;

      case 'vault':
        await toggleVault(item);
        break;

      case 'share':
        setShareModalItem(item);
        break;

      case 'info':
        if (item.type === 'folder') {
          toast(`Folder: ${item.name}`, { icon: 'ℹ️' });
        } else {
          toast(`Size: ${(item.size / 1024 / 1024).toFixed(2)} MB`, { icon: 'ℹ️' });
        }
        break;

      default:
        break;
    }
    setMenu(null);
  };

  // --- NAVIGATION + PREVIEW ---
  const handleItemDoubleClick = (item, type) => {
    if (type === 'folder') {
      // Navigate into folder - use folder_id fallback for vault folders
      const folderId = item.folder_id || item.id;
      setCurrentFolder(folderId);
      setBreadcrumbs([...breadcrumbs, { id: folderId, name: item.name }]);
    } else {
      // Open file preview
      setPreviewFile({ ...item, type: 'file' });
    }
  };

  // --- BREADCRUMB NAVIGATION ---
  const handleNavigate = (folderId, index) => {
    setCurrentFolder(folderId);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3 }}
      className="flex h-screen bg-[#0a0a0f] text-white font-sans overflow-hidden"
    >

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
      />

      {/* Hidden Vault File Input */}
      <input
        type="file"
        ref={vaultFileInputRef}
        onChange={(e) => {
          if (e.target.files?.length > 0) {
            uploadToVault(e.target.files, currentFolder);
            e.target.value = '';
          }
        }}
        className="hidden"
        multiple
      />

      {/* 1. Sidebar */}
      <Sidebar
        currentView={currentView}
        setCurrentView={(view) => {
          if (view === 'vault' && !isVaultUnlocked) {
            // Check if user has ever set a vault password
            setVaultPasswordMode(hasVaultPassword() ? 'unlock' : 'create');
            setIsVaultPasswordModalOpen(true);
            return;
          }
          setCurrentView(view);
          if (view === 'drive') {
            setCurrentFolder(null);
            setBreadcrumbs([{ id: null, name: 'My Drive' }]);
          } else if (view === 'vault') {
            setCurrentFolder(null);
            setBreadcrumbs([{ id: null, name: 'Vault' }]);
          }
        }}
        stats={stats}
        progress={progress}
        setCurrentFolder={setCurrentFolder}
        setBreadcrumbs={setBreadcrumbs}
        onUpload={handleFileSelect}
        onCreateFolder={() => {
          const name = prompt("Enter folder name:");
          if (name) handleCreateFolder(name, currentView === 'vault');
        }}
        isVaultUnlocked={isVaultUnlocked}
        onLockVault={handleLockVault}
      />

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-white dark:bg-slate-900 m-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">

        {/* Navbar */}
        <Navbar
          onSearch={(q) => fetchContent(q)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenProfile={() => setIsProfileOpen(true)}
        />

        {/* 3. Dynamic Content */}
        {currentView === 'activity' ? (
          <div className="flex-1 overflow-y-auto">
            <ActivityLog />
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10 transition-colors">

              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                {currentView === 'vault' && (
                  <Lock size={14} className="text-purple-500" />
                )}
                {breadcrumbs.map((crumb, i) => (
                  <div key={crumb.id || 'root'} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />}
                    <button
                      onClick={() => handleNavigate(crumb.id, i)}
                      className={`hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded-md transition-colors flex items-center gap-1.5 ${i === breadcrumbs.length - 1 ? 'text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-900/30' : 'hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      {i === 0 && currentView !== 'vault' && <Home size={14} />}
                      {crumb.name}
                    </button>
                  </div>
                ))}
              </div>

              {/* View Controls */}
              <div className="flex items-center gap-2">
                {/* Vault Upload Button */}
                {currentView === 'vault' && isVaultUnlocked && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => vaultFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all"
                  >
                    <UploadCloud size={16} />
                    Upload to Vault
                  </motion.button>
                )}

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 cursor-pointer transition-colors"
                >
                  <option value="date">Sort by Date</option>
                  <option value="name">Sort by Name</option>
                  <option value="size">Sort by Size</option>
                </select>

                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  >
                    <LayoutGrid size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  >
                    <List size={18} />
                  </button>
                </div>

                {/* Graph View */}
                <GraphView onSelectFile={(fileId) => {
                  // Find file and open preview
                  const file = content.files.find(f => f.file_id === fileId);
                  if (file) setPreviewFile({ ...file, type: 'file' });
                }} />
              </div>
            </div>

            {/* File Grid with Drag & Drop */}
            <div
              className={`flex-1 overflow-y-auto scroll-smooth relative transition-colors ${isDragging ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}
              onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}
              onClick={() => setMenu(null)}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Drag Overlay */}
              {isDragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-500/20 border-2 border-dashed border-indigo-400 dark:border-indigo-500 rounded-xl m-4 z-30 flex items-center justify-center pointer-events-none"
                >
                  <div className="text-center">
                    <motion.div
                      animate={{ y: [0, -10, 0] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      <Upload size={48} className="mx-auto text-indigo-500 mb-2" />
                    </motion.div>
                    <p className="text-indigo-600 dark:text-indigo-400 font-semibold">Drop files here to upload</p>
                  </div>
                </motion.div>
              )}

              {/* Upload Progress Bar */}
              {progress > 0 && progress < 100 && (
                <div className="mx-6 mt-4">
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Uploading... {progress}%</p>
                </div>
              )}

              <FileGrid
                files={content.files}
                folders={content.folders}
                viewMode={viewMode}
                sortBy={sortBy}
                isTrashView={currentView === 'trash'}
                onNavigate={handleItemDoubleClick}
                onContextMenu={(e, item, type) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const x = Math.min(e.clientX, window.innerWidth - 220);
                  const y = Math.min(e.clientY, window.innerHeight - 300);
                  setMenu({ x, y, item, type: type || item.type });
                }}
                onMove={handleMove}
              />
            </div>
          </>
        )}

        {/* Context Menu */}
        {menu && (
          <ContextMenu
            {...menu}
            onClose={() => setMenu(null)}
            onAction={handleAction}
            isTrashView={currentView === 'trash'}
          />
        )}

      </main>

      {/* Modals */}
      <ShareModal
        isOpen={!!shareModalItem}
        onClose={() => setShareModalItem(null)}
        item={shareModalItem}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        stats={stats}
      />
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        stats={stats}
      />

      {/* Preview Modal */}
      {previewFile && (
        <PreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={handleDownload}
        />
      )}

      {/* Vault Password Modal */}
      <VaultPasswordModal
        isOpen={isVaultPasswordModalOpen}
        onClose={() => setIsVaultPasswordModalOpen(false)}
        onUnlock={(password) => {
          setIsVaultUnlocked(true);
          setCurrentView('vault');
          setCurrentFolder(null);
          setBreadcrumbs([{ id: null, name: 'Vault' }]);
          toast.success('Vault unlocked', { icon: '🔓' });
        }}
        mode={vaultPasswordMode}
      />

      {/* Sanchay Memory - Chat with Drive */}
      <ChatWithDrive />
    </motion.div>
  );
};

export default Dashboard;