import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

const useDriveContent = (currentView, currentFolder, searchQuery) => {
    const [content, setContent] = useState({ folders: [], files: [] });
    const [stats, setStats] = useState({ count: 0, used: 0 });
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchContent = useCallback(async () => {
        if (currentView === 'search' && !searchQuery) return;
        setLoading(true);
        try {
            let res;
            if (currentView === 'search') {
                res = await api.get(`/drive/search?query=${searchQuery}`);
                setContent({ folders: [], files: res.data });
            } else {
                let params = currentView === 'drive' ? (currentFolder ? { folderId: currentFolder } : {}) : { filter: currentView };
                res = await api.get('/drive/content', { params });
                setContent(res.data);
            }
        } catch (error) {
            if (error.response?.status === 403) navigate('/login');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [currentView, currentFolder, searchQuery, navigate]);

    const fetchStats = useCallback(async () => {
        try {
            const res = await api.get('/drive/stats');
            setStats(res.data);
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        fetchContent();
        fetchStats();
    }, [fetchContent, fetchStats]);

    return { content, stats, loading, refresh: fetchContent, refreshStats: fetchStats };
};

export default useDriveContent;