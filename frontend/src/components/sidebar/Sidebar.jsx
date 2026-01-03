import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, Clock, Star, Trash2, UploadCloud, FolderPlus, Activity, Zap, Lock } from 'lucide-react';
import { formatBytes } from '../../utils/helpers';

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
        { id: 'vault', label: 'Vault', icon: Lock },
        { id: 'activity', label: 'Activity', icon: Activity },
        { id: 'recent', label: 'Recent', icon: Clock },
        { id: 'starred', label: 'Starred', icon: Star },
        { id: 'trash', label: 'Trash', icon: Trash2 },
    ];

    const quotaLimit = stats.count <= 1 ? (1024 * 1024 * 1024 * 1024) : (5 * 1024 * 1024 * 1024);
    const quotaPercent = Math.min(100, (stats.used / quotaLimit) * 100);

    // Magnetic button effect
    const MagneticNav = ({ children, isActive, onClick }) => {
        const ref = useRef(null);

        const handleMouseMove = (e) => {
            const btn = ref.current;
            if (!btn || isActive) return;
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px)`;
        };

        const handleMouseLeave = () => {
            if (ref.current) ref.current.style.transform = 'translate(0, 0)';
        };

        return (
            <motion.button
                ref={ref}
                onClick={onClick}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${isActive
                    ? 'bg-white/10 text-white shadow-lg shadow-indigo-500/10 border border-white/10'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    }`}
            >
                {children}
            </motion.button>
        );
    };

    return (
        <aside className="w-72 bg-[#0c0c14]/80 backdrop-blur-2xl border-r border-white/5 flex flex-col hidden md:flex z-20">
            {/* Logo Section */}
            <div className="p-6 border-b border-white/5">
                <motion.div
                    className="flex items-center gap-3"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <motion.div
                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30"
                        animate={{
                            boxShadow: [
                                '0 4px 20px rgba(99, 102, 241, 0.3)',
                                '0 4px 30px rgba(139, 92, 246, 0.4)',
                                '0 4px 20px rgba(99, 102, 241, 0.3)',
                            ]
                        }}
                        transition={{ duration: 3, repeat: Infinity }}
                    >
                        <Zap size={22} className="text-white" />
                    </motion.div>
                    <div>
                        <h1 className="text-lg font-bold text-white">Sanchay</h1>
                        <p className="text-xs text-white/30">Cloud Storage</p>
                    </div>
                </motion.div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 space-y-2">
                <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onUpload}
                    className="w-full relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_100%] text-white font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 transition-all hover:bg-right"
                >
                    <UploadCloud size={20} />
                    Upload File
                    {/* Shimmer */}
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                        animate={{ x: ['-200%', '200%'] }}
                        transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                    />
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.1)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onCreateFolder}
                    className="w-full bg-white/5 border border-white/10 text-white/70 hover:text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                    <FolderPlus size={20} />
                    New Folder
                </motion.button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
                {navItems.map((item, index) => (
                    <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        <MagneticNav
                            isActive={currentView === item.id}
                            onClick={() => {
                                setCurrentView(item.id);
                                if (item.id === 'drive') {
                                    setCurrentFolder(null);
                                    setBreadcrumbs([{ id: null, name: 'My Drive' }]);
                                }
                            }}
                        >
                            <item.icon size={18} />
                            {item.label}
                            {currentView === item.id && (
                                <motion.div
                                    layoutId="activeIndicator"
                                    className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400"
                                />
                            )}
                        </MagneticNav>
                    </motion.div>
                ))}
            </nav>

            {/* Storage Meter */}
            <div className="p-4 border-t border-white/5">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-white/5 rounded-xl border border-white/5"
                >
                    <div className="flex justify-between text-xs font-medium text-white/50 mb-3">
                        <span>Storage</span>
                        <span className="text-white/80">{Math.round(quotaPercent)}%</span>
                    </div>

                    {/* Progress bar */}
                    <div className="relative h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${quotaPercent}%` }}
                            transition={{ duration: 1.5, ease: 'easeOut' }}
                            className={`absolute inset-y-0 left-0 rounded-full ${quotaPercent > 90
                                ? 'bg-gradient-to-r from-red-500 to-orange-500'
                                : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
                                }`}
                        />
                        {/* Glow */}
                        <motion.div
                            className="absolute inset-y-0 left-0 rounded-full blur-sm"
                            style={{
                                width: `${quotaPercent}%`,
                                background: quotaPercent > 90
                                    ? 'linear-gradient(to right, #ef4444, #f97316)'
                                    : 'linear-gradient(to right, #6366f1, #8b5cf6, #ec4899)'
                            }}
                            animate={{ opacity: [0.5, 0.8, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                    </div>

                    <p className="text-xs text-white/30">
                        {formatBytes(stats.used || 0)} of {stats.count <= 1 ? "1 TB" : "5 GB"}
                    </p>
                </motion.div>
            </div>
        </aside>
    );
};

export default Sidebar;