import React from 'react';
import { motion } from 'framer-motion';
import { HardDrive, Clock, Star, Trash2, UploadCloud, FolderPlus, Activity } from 'lucide-react';
import { formatBytes } from '../../utils/helpers';
import { MorphingLogo } from '../animations';

const Sidebar = ({
    currentView,
    setCurrentView,
    setCurrentFolder,
    setBreadcrumbs,
    stats,
    onUpload,
    onCreateFolder
}) => {

    const navItems = [
        { id: 'drive', label: 'My Drive', icon: HardDrive },
        { id: 'activity', label: 'Activity', icon: Activity },
        { id: 'recent', label: 'Recent', icon: Clock },
        { id: 'starred', label: 'Starred', icon: Star },
        { id: 'trash', label: 'Trash', icon: Trash2 },
    ];

    // Calculate Storage Percentage
    const quotaLimit = stats.count <= 1 ? (1024 * 1024 * 1024 * 1024) : (5 * 1024 * 1024 * 1024);
    const quotaPercent = Math.min(100, (stats.used / quotaLimit) * 100);

    return (
        <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col hidden md:flex z-20 transition-colors duration-300">
            <div className="p-6">
                {/* Animated Logo Section */}
                <div className="mb-8">
                    <MorphingLogo size="md" animate={true} showText={true} />
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 mb-6">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onUpload}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 dark:shadow-indigo-500/20 transition-all"
                    >
                        <UploadCloud size={20} /> Upload File
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onCreateFolder}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                        <FolderPlus size={20} /> New Folder
                    </motion.button>
                </div>

                {/* Navigation */}
                <nav className="space-y-1">
                    {navItems.map((item, index) => (
                        <motion.button
                            key={item.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => {
                                setCurrentView(item.id);
                                if (item.id === 'drive') {
                                    setCurrentFolder(null);
                                    setBreadcrumbs([{ id: null, name: 'My Drive' }]);
                                }
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all ${currentView === item.id
                                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            <item.icon size={18} />
                            {item.label}
                        </motion.button>
                    ))}
                </nav>
            </div>

            {/* Storage Meter */}
            <div className="mt-auto px-6 pb-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-700"
                >
                    <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                        <span>Storage</span>
                        <span>{Math.round(quotaPercent)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${quotaPercent}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full ${quotaPercent > 90 ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
                        />
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                        {formatBytes(stats.used || 0)} used of {stats.count <= 1 ? "1 TB" : "5 GB"}
                    </p>
                </motion.div>
            </div>
        </aside>
    );
};

export default Sidebar;