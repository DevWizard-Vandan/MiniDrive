import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Settings, Palette, Download, Trash2, User, Shield,
    Moon, Sun, Monitor, AlertTriangle, Check
} from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

const SettingsModal = ({ isOpen, onClose, stats }) => {
    const [activeTab, setActiveTab] = useState('appearance');
    const { theme, setTheme, isDark } = useTheme();
    const [isExporting, setIsExporting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const navigate = useNavigate();

    const tabs = [
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'data', label: 'Data & Export', icon: Download },
        { id: 'account', label: 'Account', icon: User },
        { id: 'privacy', label: 'Privacy', icon: Shield },
    ];

    const themes = [
        { id: 'light', label: 'Light', icon: Sun },
        { id: 'dark', label: 'Dark', icon: Moon },
        { id: 'system', label: 'System', icon: Monitor },
    ];

    const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
        toast.success(`Theme changed to ${newTheme}`);
    };

    const handleExportData = async () => {
        setIsExporting(true);
        try {
            const res = await api.get('/drive/content');
            const data = {
                exportDate: new Date().toISOString(),
                files: res.data.files || [],
                folders: res.data.folders || [],
                stats: stats
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `sanchaycloud-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success("Data exported successfully!");
        } catch (err) {
            toast.error("Failed to export data");
        } finally {
            setIsExporting(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== 'DELETE') {
            toast.error("Please type DELETE to confirm");
            return;
        }

        if (!deletePassword || deletePassword.length < 1) {
            toast.error("Please enter your password");
            return;
        }

        const toastId = toast.loading("Deleting account...");
        try {
            await api.delete('/auth/account', { data: { password: deletePassword } });
            toast.success("Account deleted. Goodbye!", { id: toastId });
            localStorage.clear();
            navigate('/login');
        } catch (err) {
            const msg = err.response?.data?.error || "Failed to delete account";
            toast.error(msg, { id: toastId });
        }
    };

    const handleClearCache = () => {
        localStorage.removeItem('searchHistory');
        localStorage.removeItem('recentFiles');
        toast.success("Cache cleared!");
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700"
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl">
                                <Settings size={20} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Settings</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex flex-1 overflow-hidden">
                        {/* Sidebar */}
                        <div className="w-48 border-r border-slate-100 dark:border-slate-800 p-3 flex-shrink-0 bg-slate-50 dark:bg-slate-950">
                            {tabs.map((tab) => (
                                <motion.button
                                    key={tab.id}
                                    whileHover={{ x: 2 }}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-1 ${activeTab === tab.id
                                        ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50'
                                        }`}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </motion.button>
                            ))}
                        </div>

                        {/* Panel */}
                        <div className="flex-1 p-6 overflow-y-auto">
                            {activeTab === 'appearance' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-6"
                                >
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Theme</h3>
                                        <div className="grid grid-cols-3 gap-3">
                                            {themes.map((t) => (
                                                <motion.button
                                                    key={t.id}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => handleThemeChange(t.id)}
                                                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${theme === t.id
                                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                        }`}
                                                >
                                                    <t.icon size={24} className={theme === t.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                                                    <span className={`text-sm font-medium ${theme === t.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}>
                                                        {t.label}
                                                    </span>
                                                    {theme === t.id && (
                                                        <motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                        >
                                                            <Check size={14} className="text-indigo-600 dark:text-indigo-400" />
                                                        </motion.div>
                                                    )}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Display</h3>
                                        <div className="space-y-3">
                                            <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                                <span className="text-sm text-slate-700 dark:text-slate-200">Compact mode</span>
                                                <input type="checkbox" className="w-5 h-5 accent-indigo-600 rounded" />
                                            </label>
                                            <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                                <span className="text-sm text-slate-700 dark:text-slate-200">Show file extensions</span>
                                                <input type="checkbox" defaultChecked className="w-5 h-5 accent-indigo-600 rounded" />
                                            </label>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'data' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-6"
                                >
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Export Your Data</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                            Download a copy of your files metadata and folder structure.
                                        </p>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={handleExportData}
                                            disabled={isExporting}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                        >
                                            <Download size={18} />
                                            {isExporting ? 'Exporting...' : 'Export Data (JSON)'}
                                        </motion.button>
                                    </div>

                                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                                        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Storage Usage</h3>
                                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                                            <div className="flex justify-between text-sm mb-2">
                                                <span className="text-slate-600 dark:text-slate-400">Used</span>
                                                <span className="font-medium text-slate-800 dark:text-white">
                                                    {((stats?.used || 0) / 1024 / 1024).toFixed(2)} MB
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${Math.min(100, ((stats?.used || 0) / (5 * 1024 * 1024 * 1024)) * 100)}%` }}
                                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                                                />
                                            </div>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">5 GB total storage</p>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                                        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Cache</h3>
                                        <button
                                            onClick={handleClearCache}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            <Trash2 size={18} />
                                            Clear Local Cache
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'account' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-6"
                                >
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Profile</h3>
                                        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                                                V
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-800 dark:text-white">User</p>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">Member since 2026</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                                        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                                            <AlertTriangle size={16} />
                                            Danger Zone
                                        </h3>

                                        {!showDeleteConfirm ? (
                                            <button
                                                onClick={() => setShowDeleteConfirm(true)}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                            >
                                                <Trash2 size={18} />
                                                Delete Account
                                            </button>
                                        ) : (
                                            <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
                                                <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                                                    This will permanently delete your account. Type <strong>DELETE</strong> and enter your password to confirm.
                                                </p>
                                                <input
                                                    type="text"
                                                    value={deleteConfirmText}
                                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                                    placeholder="Type DELETE"
                                                    className="w-full px-3 py-2 border border-red-200 dark:border-red-700 bg-white dark:bg-slate-800 rounded-lg mb-3 text-sm text-slate-800 dark:text-white"
                                                />
                                                <input
                                                    type="password"
                                                    value={deletePassword}
                                                    onChange={(e) => setDeletePassword(e.target.value)}
                                                    placeholder="Enter your password"
                                                    className="w-full px-3 py-2 border border-red-200 dark:border-red-700 bg-white dark:bg-slate-800 rounded-lg mb-3 text-sm text-slate-800 dark:text-white"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleDeleteAccount}
                                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                                                    >
                                                        Confirm Delete
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setShowDeleteConfirm(false);
                                                            setDeleteConfirmText('');
                                                            setDeletePassword('');
                                                        }}
                                                        className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'privacy' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-6"
                                >
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Privacy Settings</h3>
                                        <div className="space-y-3">
                                            <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                                <div>
                                                    <span className="text-sm text-slate-700 dark:text-slate-200 block">Activity History</span>
                                                    <span className="text-xs text-slate-400 dark:text-slate-500">Track file operations</span>
                                                </div>
                                                <input type="checkbox" defaultChecked className="w-5 h-5 accent-indigo-600 rounded" />
                                            </label>
                                            <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                                <div>
                                                    <span className="text-sm text-slate-700 dark:text-slate-200 block">Share Analytics</span>
                                                    <span className="text-xs text-slate-400 dark:text-slate-500">Track who views shared files</span>
                                                </div>
                                                <input type="checkbox" defaultChecked className="w-5 h-5 accent-indigo-600 rounded" />
                                            </label>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default SettingsModal;
