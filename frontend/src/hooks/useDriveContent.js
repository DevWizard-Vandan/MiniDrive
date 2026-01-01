import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { calculateHash } from '../utils/helpers';

export const useDriveContent = () => {
    const [content, setContent] = useState({ folders: [], files: [] });
    const [currentView, setCurrentView] = useState('drive');
    const [currentFolder, setCurrentFolder] = useState(null);
    const [breadcrumbs, setBreadcrumbs] = useState([{ id: null, name: 'My Drive' }]);
    const [stats, setStats] = useState({ count: 0, used: 0 });
    const [progress, setProgress] = useState(0);

    const navigate = useNavigate();
    const CHUNK_SIZE = 1024 * 1024;

    const fetchContent = useCallback(async (searchQuery = "") => {
        if (currentView === 'search' && !searchQuery) return;

        try {
            let url = '/drive/content';
            let params = {};

            if (searchQuery) {
                url = '/drive/search';
                params.query = searchQuery;
            } else if (currentView === 'drive') {
                if (currentFolder) params.folderId = currentFolder;
            } else {
                params.filter = currentView;
            }

            const res = await api.get(url, { params });

            if (url.includes('search')) {
                setContent({ folders: [], files: res.data });
            } else {
                setContent(res.data);
            }
        } catch (error) {
            if (error.response?.status === 403) navigate('/login');
            console.error("Fetch error:", error);
        }
    }, [currentView, currentFolder, navigate]);

    const fetchStats = useCallback(async () => {
        try { const res = await api.get('/drive/stats'); setStats(res.data); } catch(e){}
    }, []);

    useEffect(() => { fetchContent(); fetchStats(); }, [fetchContent, fetchStats]);

    // --- ACTIONS ---
    const handleUpload = async (files) => {
        for (const file of Array.from(files)) {
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
                    const hash = await calculateHash(chunk);
                    const chunkData = new FormData();
                    chunkData.append('uploadId', uploadId); chunkData.append('index', i);
                    chunkData.append('hash', hash); chunkData.append('chunk', chunk);
                    await api.post('/drive/upload/chunk', chunkData);
                    setProgress(Math.round(((i + 1) / totalChunks) * 100));
                }
                await api.post(`/drive/complete?uploadId=${uploadId}`);
                toast.success(`Uploaded ${file.name}`);
            } catch (error) { toast.error("Upload Failed"); }
        }
        setProgress(0);
        fetchContent();
        fetchStats();
    };

    const handleCreateFolder = async (name) => {
        try {
            await api.post('/drive/folders', { name, parentId: currentFolder });
            fetchContent();
            return true;
        } catch (err) { toast.error("Failed to create folder"); return false; }
    };

    const deleteItem = async (item, permanent = false) => {
        try {
            if (permanent) {
                await api.delete(`/drive/${item.id}/permanent`);
                toast.success("Deleted forever");
            } else {
                await api.post('/drive/action/trash', {
                    id: item.id,
                    type: item.type, // Explicitly sending 'folder' or 'file'
                    value: true
                });
                toast.success("Moved to Trash");
            }
            fetchContent();
            fetchStats();
        } catch (e) { toast.error("Action failed"); }
    };

    const restoreItem = async (item) => {
        try {
            await api.post('/drive/action/trash', {
                id: item.id,
                type: item.type,
                value: false
            });
            toast.success("Restored");
            fetchContent();
        } catch (e) { toast.error("Restore failed"); }
    };

    const toggleStar = async (item) => {
        try {
            await api.post('/drive/action/star', {
                id: item.id,
                type: item.type,
                value: !item.starred
            });
            fetchContent();
        } catch (e) { toast.error("Failed to update star"); }
    };

    return {
        content, stats, progress,
        currentView, setCurrentView,
        currentFolder, setCurrentFolder,
        breadcrumbs, setBreadcrumbs,

        fetchContent, handleUpload, handleCreateFolder,
        deleteItem, restoreItem, toggleStar
    };
};