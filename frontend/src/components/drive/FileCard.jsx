import React from 'react';
import { motion } from 'framer-motion';
import { File, FileImage, FileVideo, FileText, Folder, Star } from 'lucide-react';
import { formatBytes } from '../../utils/helpers';

const FileCard = ({ item, type, onNavigate, onMove, isTrashView, onContextMenu }) => {
    const isFolder = type === 'folder';

    // Icon Configuration
    let Icon = File;
    let colorClass = "bg-slate-100/50 text-slate-500";
    let iconColor = "text-slate-500";

    if (isFolder) {
        Icon = Folder;
        colorClass = "bg-indigo-100/50";
        iconColor = "text-indigo-600";
    } else {
        const ext = item.name.split('.').pop().toLowerCase();
        if (['jpg', 'png', 'jpeg'].includes(ext)) { colorClass = "bg-purple-100/50"; iconColor = "text-purple-600"; Icon = FileImage; }
        if (['mp4', 'mkv', 'mov'].includes(ext)) { colorClass = "bg-red-100/50"; iconColor = "text-red-600"; Icon = FileVideo; }
        if (['pdf', 'doc', 'txt'].includes(ext)) { colorClass = "bg-blue-100/50"; iconColor = "text-blue-600"; Icon = FileText; }
    }

    const handleDragStart = (e) => {
        e.dataTransfer.setData("itemId", item.id);
        e.dataTransfer.setData("itemType", type);
    };

    const handleDrop = (e) => {
        e.preventDefault(); e.stopPropagation();
        const draggedId = e.dataTransfer.getData("itemId");
        const draggedType = e.dataTransfer.getData("itemType");
        if (isFolder && draggedId !== item.id.toString()) {
            onMove(draggedId, draggedType, item.id);
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            draggable={!isTrashView}
            onDragStart={handleDragStart}
            onDragOver={(e) => isFolder && e.preventDefault()}
            onDrop={handleDrop}
            onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item, type); }}
            onDoubleClick={() => isFolder && !isTrashView && onNavigate(item)}
            className={`
                group relative p-4 rounded-2xl cursor-pointer transition-all duration-300
                bg-white/40 backdrop-blur-md border border-white/20 shadow-lg
                hover:bg-white/60 hover:shadow-2xl hover:border-white/40
                ${isFolder ? 'folder-3d' : 'hover-scale'}
            `}
        >
            {/* The 3D Inner Content */}
            <div className={isFolder ? "card-3d-inner transform-style-3d" : ""}>
                <div className={`
                    h-32 rounded-xl flex items-center justify-center mb-4 transition-colors
                    ${colorClass} group-hover:bg-opacity-70
                `}>
                    <Icon size={48} className={`${iconColor} drop-shadow-sm transition-transform duration-300 group-hover:scale-110`} />
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between items-start">
                        <h3 className="font-semibold text-slate-700 text-sm truncate w-full pr-2" title={item.name}>
                            {item.name}
                        </h3>
                        {item.starred && !isTrashView && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                <Star size={14} className="text-yellow-500 fill-yellow-500" />
                            </motion.div>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                        {isFolder ? "Folder" : formatBytes(item.size)}
                    </p>
                </div>
            </div>
        </motion.div>
    );
};

export default FileCard;