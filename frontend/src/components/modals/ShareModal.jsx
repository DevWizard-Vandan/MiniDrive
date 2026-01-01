import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link, Copy, Check, Trash2, ExternalLink, Share2 } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';

const ShareModal = ({ isOpen, onClose, item }) => {
    const [shareUrl, setShareUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const generateLink = async () => {
        if (!item || item.type === 'folder') {
            toast.error("Only files can be shared");
            return;
        }

        setIsLoading(true);
        try {
            const res = await api.post(`/drive/share/${item.id}`);
            setShareUrl(res.data.url);
            toast.success("Share link created!");
        } catch (err) {
            toast.error("Failed to create share link");
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            toast.success("Link copied!");
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error("Failed to copy");
        }
    };

    const revokeLink = async () => {
        setIsLoading(true);
        try {
            await api.delete(`/drive/share/${item.id}`);
            setShareUrl('');
            toast.success("Share link revoked");
        } catch (err) {
            toast.error("Failed to revoke link");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setShareUrl('');
        setCopied(false);
        onClose();
    };

    if (!isOpen || !item) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700"
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl">
                                <Share2 size={20} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Share File</h2>
                        </div>
                        <button onClick={handleClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* File Info */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-6"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/50 dark:to-indigo-800/50 rounded-xl flex items-center justify-center">
                                <Link size={20} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-700 dark:text-slate-200 truncate">{item.name}</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">Anyone with the link can view</p>
                            </div>
                        </motion.div>

                        {item.type === 'folder' ? (
                            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                                <p className="font-medium">Folder sharing coming soon</p>
                                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Only individual files can be shared.</p>
                            </div>
                        ) : shareUrl ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                {/* Share Link Display */}
                                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl mb-4">
                                    <input
                                        type="text"
                                        value={shareUrl}
                                        readOnly
                                        className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none"
                                    />
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={copyToClipboard}
                                        className="p-2 hover:bg-green-100 dark:hover:bg-green-800/50 rounded-lg transition-colors"
                                    >
                                        {copied ? (
                                            <Check size={18} className="text-green-600 dark:text-green-400" />
                                        ) : (
                                            <Copy size={18} className="text-green-600 dark:text-green-400" />
                                        )}
                                    </motion.button>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <motion.a
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        href={shareUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
                                    >
                                        <ExternalLink size={16} /> Open Link
                                    </motion.a>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={revokeLink}
                                        disabled={isLoading}
                                        className="px-4 py-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                                    >
                                        <Trash2 size={16} />
                                    </motion.button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={generateLink}
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 font-medium shadow-lg shadow-indigo-500/30"
                            >
                                {isLoading ? (
                                    <motion.span
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                    >
                                        ⏳
                                    </motion.span>
                                ) : (
                                    <>
                                        <Link size={18} />
                                        Generate Share Link
                                    </>
                                )}
                            </motion.button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ShareModal;
