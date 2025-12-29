import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { calculateHash } from '../utils/helpers';

export const useDriveContent = () => {
    // --- INTERNAL STATE ---
    const [content, setContent] = useState({ folders: [], files: [] });
    const [currentView, setCurrentView] = useState('drive');
    const [currentFolder, setCurrentFolder] = useState(null);
    const [breadcrumbs, setBreadcrumbs] = useState([{ id: null, name: 'My Drive' }]);
    const [stats, setStats] = useState({ count: 0, used: 0 });
    const [progress, setProgress] = useState(0);

    const navigate = useNavigate();
    const CHUNK_SIZE = 1024 * 1024;

    // --- FETCH LOGIC ---
    const fetchContent = useCallback(async (searchQuery = "") => {
        // If in search view but query is empty, don't fetch
        if (currentView === 'search' && !searchQuery) return;

        try {
            let url = '/drive/content';
            let params = {};

            if (searchQuery) {
                url = '/drive/search';
                params.query = searchQuery;
                // If we are searching, we temporarily switch view logic in the UI
            } else if (currentView === 'drive') {
                if (currentFolder) params.folderId = currentFolder;
            } else {
                params.filter = currentView;
            }

            const res = await api.get(url, { params });

            // If searching, the API returns a list, so we map it to our structure
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

    // Initial Load
    useEffect(() => {
        fetchContent();
        fetchStats();
    }, [fetchContent, fetchStats]);

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
            } catch (error) {
                console.error(error);
                toast.error(typeof error.response?.data === 'string' ? error.response.data : "Upload Failed");
            }
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

    const handleMoveItem = async (itemId, type, targetFolderId) => {
        try {
            await api.post('/drive/action/move', { id: itemId, type, targetId: targetFolderId });
            toast.success("Moved successfully");
            fetchContent();
        } catch (err) { toast.error("Move failed"); }
    };

    const deleteItem = async (id, permanent = false) => {
        try {
            if (permanent) await api.delete(`/drive/${id}/permanent`);
            else await api.post('/drive/action/trash', { id, value: true });
            fetchContent();
            fetchStats(); // Update storage meter
            toast.success(permanent ? "Deleted forever" : "Moved to Trash");
        } catch (e) { toast.error("Delete failed"); }
    };

    // --- RETURN EVERYTHING NEEDED BY DASHBOARD ---
    return {
        // State
        content, stats, progress,
        currentView, setCurrentView,
        currentFolder, setCurrentFolder,
        breadcrumbs, setBreadcrumbs,

        // Actions
        fetchContent, // <--- This solves your error!
        handleUpload,
        handleCreateFolder,
        handleMoveItem,
        deleteItem
    };
};