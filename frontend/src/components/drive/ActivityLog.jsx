import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Upload, Trash2, FolderPlus, Star, FileText, RefreshCw, Share2, Download } from 'lucide-react';
import api from '../../api';

const ActivityLog = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await api.get('/drive/activity');
                setLogs(res.data);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        fetchLogs();
    }, []);

    const getIcon = (action) => {
        switch (action) {
            case 'UPLOAD': return <Upload size={16} className="text-blue-500" />;
            case 'TRASH': return <Trash2 size={16} className="text-red-500" />;
            case 'RESTORE': return <RefreshCw size={16} className="text-green-500" />;
            case 'CREATE_FOLDER': return <FolderPlus size={16} className="text-indigo-500" />;
            case 'STAR': return <Star size={16} className="text-yellow-500" />;
            case 'SHARE': return <Share2 size={16} className="text-purple-500" />;
            case 'DELETE_FOREVER': return <Trash2 size={16} className="text-red-600" />;
            default: return <FileText size={16} className="text-slate-500 dark:text-slate-400" />;
        }
    };

    const formatAction = (action) => {
        switch (action) {
            case 'UPLOAD': return "uploaded";
            case 'TRASH': return "moved to trash";
            case 'RESTORE': return "restored";
            case 'CREATE_FOLDER': return "created folder";
            case 'STAR': return "starred";
            case 'SHARE': return "shared";
            case 'DELETE_FOREVER': return "permanently deleted";
            default: return "modified";
        }
    };

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto p-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-3xl mx-auto p-8"
        >
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl">
                    <Clock className="text-indigo-600 dark:text-indigo-400" size={24} />
                </div>
                Recent Activity
            </h2>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                {logs.length === 0 ? (
                    <div className="p-12 text-center">
                        <motion.div
                            animate={{ y: [0, -10, 0] }}
                            transition={{ repeat: Infinity, duration: 3 }}
                            className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center"
                        >
                            <Clock size={32} className="text-slate-300 dark:text-slate-600" />
                        </motion.div>
                        <p className="text-slate-400 dark:text-slate-500">No recent activity</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        <div className="divide-y divide-slate-50 dark:divide-slate-800">
                            {logs.map((log, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                >
                                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                        {getIcon(log.action)}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-slate-700 dark:text-slate-200 text-sm">
                                            You {formatAction(log.action)} <span className="font-semibold text-slate-900 dark:text-white">{log.file}</span>
                                        </p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                            {new Date(log.date).toLocaleString()}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </AnimatePresence>
                )}
            </div>
        </motion.div>
    );
};

export default ActivityLog;