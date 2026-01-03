import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FileCard from './FileCard';
import { Folder as FolderIcon, FileText } from 'lucide-react';

const FileGrid = ({
    files = [],
    folders = [],
    viewMode = 'grid',
    sortBy = 'date',
    isTrashView = false,
    onNavigate,
    onContextMenu,
    onMove
}) => {
    // Combine and sort items
    const allItems = [
        ...folders.map(f => ({ ...f, type: 'folder' })),
        ...files.map(f => ({ ...f, type: 'file' }))
    ];

    const sortedItems = [...allItems].sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'size') return (b.size || 0) - (a.size || 0);
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    // Empty state
    if (sortedItems.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-[60vh] text-center px-4"
            >
                <motion.div
                    animate={{
                        y: [0, -10, 0],
                        rotateY: [0, 10, -10, 0],
                    }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="relative mb-6"
                >
                    {/* Glow */}
                    <div className="absolute inset-0 bg-indigo-500/20 rounded-3xl blur-2xl" />

                    <div className="relative w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl flex items-center justify-center border border-white/10">
                        {isTrashView ? (
                            <FileText size={40} className="text-white/30" />
                        ) : (
                            <FolderIcon size={40} className="text-white/30" />
                        )}
                    </div>
                </motion.div>

                <h3 className="text-xl font-semibold text-white/80 mb-2">
                    {isTrashView ? 'Trash is empty' : 'No files yet'}
                </h3>
                <p className="text-white/40 max-w-sm">
                    {isTrashView
                        ? 'Deleted files will appear here'
                        : 'Drag and drop files here or use the upload button'
                    }
                </p>
            </motion.div>
        );
    }

    // Grid view
    if (viewMode === 'grid') {
        return (
            <motion.div
                layout
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-6"
            >
                <AnimatePresence mode="popLayout">
                    {sortedItems.map((item, index) => (
                        <FileCard
                            key={`${item.type}-${item.id}`}
                            item={item}
                            type={item.type}
                            index={index}
                            isTrashView={isTrashView}
                            onNavigate={onNavigate}
                            onContextMenu={onContextMenu}
                            onMove={onMove}
                        />
                    ))}
                </AnimatePresence>
            </motion.div>
        );
    }

    // List view
    return (
        <div className="p-4 space-y-2">
            <AnimatePresence mode="popLayout">
                {sortedItems.map((item, index) => (
                    <motion.div
                        key={`${item.type}-${item.id}`}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.02 }}
                        whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.05)' }}
                        onClick={() => !isTrashView && onNavigate?.(item, item.type)}
                        onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, item, item.type); }}
                        className="flex items-center gap-4 p-3 rounded-xl cursor-pointer border border-transparent hover:border-white/10 transition-all"
                    >
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.type === 'folder'
                                ? 'bg-indigo-500/20'
                                : 'bg-white/5'
                            }`}>
                            {item.type === 'folder' ? (
                                <FolderIcon size={20} className="text-indigo-400" />
                            ) : (
                                <FileText size={20} className="text-white/50" />
                            )}
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                            <h4 className="text-white/90 font-medium truncate">{item.name}</h4>
                            <p className="text-xs text-white/40">
                                {item.type === 'folder' ? 'Folder' : `${(item.size / 1024).toFixed(1)} KB`}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default FileGrid;