import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { File, FileImage, FileVideo, FileText, FileArchive, Folder, Star } from 'lucide-react';
import { formatBytes } from '../../utils/helpers';

const FileCard = ({ item, type, index = 0, onNavigate, onMove, isTrashView, onContextMenu }) => {
    const isFolder = type === 'folder';
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);

    // Icon Configuration
    let Icon = File;
    let colorClass = "from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800";
    let iconColor = "text-slate-500 dark:text-slate-400";
    let glowColor = "slate";

    if (isFolder) {
        Icon = Folder;
        colorClass = "from-indigo-100 to-indigo-200 dark:from-indigo-900/50 dark:to-indigo-800/50";
        iconColor = "text-indigo-500 dark:text-indigo-400";
        glowColor = "indigo";
    } else {
        const ext = item.name.split('.').pop().toLowerCase();
        if (['jpg', 'png', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
            colorClass = "from-purple-100 to-purple-200 dark:from-purple-900/50 dark:to-purple-800/50";
            iconColor = "text-purple-500 dark:text-purple-400";
            Icon = FileImage;
            glowColor = "purple";
        }
        if (['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(ext)) {
            colorClass = "from-red-100 to-red-200 dark:from-red-900/50 dark:to-red-800/50";
            iconColor = "text-red-500 dark:text-red-400";
            Icon = FileVideo;
            glowColor = "red";
        }
        if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) {
            colorClass = "from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/50";
            iconColor = "text-blue-500 dark:text-blue-400";
            Icon = FileText;
            glowColor = "blue";
        }
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
            colorClass = "from-amber-100 to-amber-200 dark:from-amber-900/50 dark:to-amber-800/50";
            iconColor = "text-amber-500 dark:text-amber-400";
            Icon = FileArchive;
            glowColor = "amber";
        }
    }

    // 3D Tilt effect handler
    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        setTilt({ x: y * 15, y: -x * 15 });
    };

    const handleMouseLeave = () => {
        setTilt({ x: 0, y: 0 });
        setIsHovered(false);
    };

    const handleDragStart = (e) => {
        e.dataTransfer.setData("itemId", item.id);
        e.dataTransfer.setData("itemType", type);
    };

    const handleDrop = (e) => {
        e.preventDefault(); e.stopPropagation();
        const draggedId = e.dataTransfer.getData("itemId");
        const draggedType = e.dataTransfer.getData("itemType");
        if (isFolder && draggedId !== item.id.toString() && onMove) {
            onMove(draggedId, draggedType, item.id);
        }
    };

    const glowColors = {
        slate: 'rgba(100, 116, 139, 0.3)',
        indigo: 'rgba(99, 102, 241, 0.4)',
        purple: 'rgba(139, 92, 246, 0.4)',
        red: 'rgba(239, 68, 68, 0.4)',
        blue: 'rgba(59, 130, 246, 0.4)',
        amber: 'rgba(245, 158, 11, 0.4)'
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                rotateX: tilt.x,
                rotateY: tilt.y
            }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            transition={{ delay: index * 0.03, type: "spring", stiffness: 300, damping: 25 }}
            whileHover={{ y: -6, scale: 1.02 }}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={handleMouseLeave}
            draggable={!isTrashView}
            onDragStart={handleDragStart}
            onDragOver={(e) => isFolder && e.preventDefault()}
            onDrop={handleDrop}
            onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, item, type); }}
            onDoubleClick={() => isFolder && !isTrashView && onNavigate?.(item)}
            className="group relative p-3 rounded-2xl cursor-pointer bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
            style={{
                transformStyle: 'preserve-3d',
                perspective: '1000px',
                boxShadow: isHovered
                    ? `0 20px 40px -10px ${glowColors[glowColor]}, 0 0 30px ${glowColors[glowColor]}`
                    : '0 2px 4px rgba(0,0,0,0.05)'
            }}
        >
            {/* Animated gradient border on hover */}
            <motion.div
                className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: isHovered ? 1 : 0 }}
                transition={{ duration: 0.3 }}
            >
                <div className="absolute inset-[-2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl opacity-50 blur-sm animate-pulse" />
            </motion.div>

            {/* Shimmer effect on hover */}
            <motion.div
                className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
                initial={{ x: '-100%' }}
                animate={{ x: isHovered ? '200%' : '-100%' }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
            >
                <div className="w-1/3 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
            </motion.div>

            {/* Icon Container with 3D effect */}
            <motion.div
                animate={{
                    translateZ: isHovered ? 30 : 0,
                    scale: isHovered ? 1.1 : 1
                }}
                transition={{ type: 'spring', stiffness: 300 }}
                className={`relative aspect-square rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br ${colorClass} transition-all duration-300`}
                style={{ transformStyle: 'preserve-3d' }}
            >
                <motion.div
                    animate={{ rotate: isHovered ? [0, -10, 10, 0] : 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Icon size={32} className={`${iconColor} drop-shadow-lg`} />
                </motion.div>
            </motion.div>

            {/* File Info with depth */}
            <motion.div
                className="space-y-0.5 relative"
                style={{ transformStyle: 'preserve-3d' }}
                animate={{ translateZ: isHovered ? 15 : 0 }}
            >
                <div className="flex justify-between items-start gap-1">
                    <h3 className="font-medium text-slate-700 dark:text-slate-200 text-sm truncate flex-1" title={item.name}>
                        {item.name}
                    </h3>
                    {item.starred && !isTrashView && (
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            whileHover={{ scale: 1.3, rotate: 15 }}
                            className="flex-shrink-0"
                        >
                            <Star size={12} className="text-yellow-500 fill-yellow-500 mt-0.5 drop-shadow-md" />
                        </motion.div>
                    )}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                    {isFolder ? "Folder" : formatBytes(item.size)}
                </p>
            </motion.div>
        </motion.div>
    );
};

export default FileCard;