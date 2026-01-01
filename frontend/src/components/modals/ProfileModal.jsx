import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Calendar, HardDrive, Camera, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatBytes } from '../../utils/helpers';

const ProfileModal = ({ isOpen, onClose, stats }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [displayName, setDisplayName] = useState(localStorage.getItem('displayName') || 'User');
    const [email, setEmail] = useState(localStorage.getItem('email') || 'user@sanchaycloud.com');

    const handleSave = () => {
        localStorage.setItem('displayName', displayName);
        localStorage.setItem('email', email);
        setIsEditing(false);
        toast.success("Profile updated!");
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
                    className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700"
                >
                    {/* Header with animated gradient */}
                    <div className="h-28 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative overflow-hidden">
                        <motion.div
                            animate={{ x: [0, 100, 0] }}
                            transition={{ repeat: Infinity, duration: 10 }}
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                        />
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                        >
                            <X size={18} className="text-white" />
                        </button>
                    </div>

                    {/* Avatar */}
                    <div className="relative -mt-14 flex justify-center">
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="relative"
                        >
                            <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-4xl font-bold border-4 border-white dark:border-slate-900 shadow-xl">
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className="absolute bottom-1 right-1 p-2.5 bg-indigo-600 rounded-full text-white hover:bg-indigo-700 transition-colors shadow-lg"
                            >
                                <Camera size={14} />
                            </motion.button>
                        </motion.div>
                    </div>

                    {/* Content */}
                    <div className="p-6 pt-4">
                        {isEditing ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Display Name</label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 focus:border-indigo-300 dark:focus:border-indigo-700 outline-none transition-all text-slate-800 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 focus:border-indigo-300 dark:focus:border-indigo-700 outline-none transition-all text-slate-800 dark:text-white"
                                    />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleSave}
                                        className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
                                    >
                                        Save Changes
                                    </motion.button>
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <>
                                {/* Name */}
                                <div className="text-center mb-6">
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">{displayName}</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{email}</p>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <motion.div
                                        whileHover={{ scale: 1.02 }}
                                        className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 rounded-xl text-center"
                                    >
                                        <HardDrive size={24} className="mx-auto text-indigo-600 dark:text-indigo-400 mb-2" />
                                        <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{formatBytes(stats?.used || 0)}</p>
                                        <p className="text-xs text-indigo-500 dark:text-indigo-400">Storage Used</p>
                                    </motion.div>
                                    <motion.div
                                        whileHover={{ scale: 1.02 }}
                                        className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl text-center"
                                    >
                                        <Calendar size={24} className="mx-auto text-purple-600 dark:text-purple-400 mb-2" />
                                        <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{stats?.count || 0}</p>
                                        <p className="text-xs text-purple-500 dark:text-purple-400">Total Files</p>
                                    </motion.div>
                                </div>

                                {/* Info */}
                                <div className="space-y-3 mb-6">
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                        <User size={18} className="text-slate-400" />
                                        <div>
                                            <p className="text-xs text-slate-400 dark:text-slate-500">Account Type</p>
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Free Plan (5 GB)</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                        <Mail size={18} className="text-slate-400" />
                                        <div>
                                            <p className="text-xs text-slate-400 dark:text-slate-500">Email</p>
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{email}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Edit Button */}
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setIsEditing(true)}
                                    className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium flex items-center justify-center gap-2"
                                >
                                    <Edit3 size={16} />
                                    Edit Profile
                                </motion.button>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ProfileModal;
