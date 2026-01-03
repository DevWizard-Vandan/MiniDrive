import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, History, Download, Clock, FileText, RotateCcw } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';

/**
 * Version History Modal - Displays all versions of a file.
 * Allows downloading or restoring previous versions.
 */
const VersionHistory = ({ isOpen, onClose, file }) => {
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && file?.file_id) {
            fetchVersions();
        }
    }, [isOpen, file]);

    const fetchVersions = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/drive/versions/${file.file_id}`);
            setVersions(res.data);
        } catch (e) {
            toast.error("Failed to load version history");
        } finally {
            setLoading(false);
        }
    };

    const downloadVersion = async (versionNumber) => {
        try {
            const res = await api.get(`/drive/download/${file.file_id}/version/${versionNumber}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `v${versionNumber}_${file.name}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success(`Downloaded version ${versionNumber}`);
        } catch (e) {
            toast.error("Failed to download version");
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                                <History size={20} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Version History</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-[280px]">
                                    {file?.name}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto max-h-[60vh]">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                            </div>
                        ) : versions.length === 0 ? (
                            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                                <p>No version history available</p>
                                <p className="text-sm mt-2">Upload a new version to start tracking</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {versions.map((version, index) => (
                                    <motion.div
                                        key={version.versionNumber}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold
                                                ${index === 0
                                                    ? 'bg-indigo-500 text-white'
                                                    : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                                                }`}
                                            >
                                                v{version.versionNumber}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                                                        Version {version.versionNumber}
                                                    </span>
                                                    {index === 0 && (
                                                        <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded-full">
                                                            Latest
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={12} />
                                                        {formatDate(version.createdAt)}
                                                    </span>
                                                    <span>{formatSize(version.size)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => downloadVersion(version.versionNumber)}
                                                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                title="Download this version"
                                            >
                                                <Download size={18} className="text-slate-600 dark:text-slate-300" />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default VersionHistory;
