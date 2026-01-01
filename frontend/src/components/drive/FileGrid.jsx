import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UploadCloud, File, FileImage, FileVideo, FileText, Folder, Star, MoreVertical } from 'lucide-react';
import FileCard from './FileCard';
import { formatBytes } from '../../utils/helpers';

const FileGrid = ({
    items,
    files = [],
    folders = [],
    viewMode = 'grid',
    sortBy = 'date',
    onNavigate,
    onAction,
    onMove,
    onContextMenu,
    isTrashView
}) => {
    const allItems = items || [...folders, ...files];

    const getSortedItems = (list) => {
        let sorted = [...list];
        if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
        else if (sortBy === 'size') sorted.sort((a, b) => (b.size || 0) - (a.size || 0));
        else sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
        return sorted;
    };

    if (allItems.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center text-center pb-20"
            >
                <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    className="w-32 h-32 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mb-6"
                >
                    <UploadCloud size={64} className="text-indigo-300 dark:text-indigo-600" />
                </motion.div>
                <h3 className="text-xl font-bold text-slate-600 dark:text-slate-300">It's empty here</h3>
                <p className="text-slate-400 dark:text-slate-500">Upload a file or create a folder to get started</p>
            </motion.div>
        );
    }

    // List View
    if (viewMode === 'list') {
        return (
            <div className="px-6 py-4">
                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                    <div className="col-span-6">Name</div>
                    <div className="col-span-2">Size</div>
                    <div className="col-span-3">Modified</div>
                    <div className="col-span-1"></div>
                </div>

                <AnimatePresence mode="popLayout">
                    {getSortedItems(allItems).map((item, index) => {
                        const isFolder = item.type === 'folder';
                        let Icon = File;
                        let iconColor = "text-slate-400 dark:text-slate-500";

                        if (isFolder) {
                            Icon = Folder;
                            iconColor = "text-indigo-500";
                        } else {
                            const ext = item.name.split('.').pop().toLowerCase();
                            if (['jpg', 'png', 'jpeg', 'gif', 'webp'].includes(ext)) { iconColor = "text-purple-500"; Icon = FileImage; }
                            if (['mp4', 'mkv', 'mov', 'avi'].includes(ext)) { iconColor = "text-red-500"; Icon = FileVideo; }
                            if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) { iconColor = "text-blue-500"; Icon = FileText; }
                        }

                        return (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ delay: index * 0.02 }}
                                onDoubleClick={() => isFolder && !isTrashView && onNavigate?.(item)}
                                onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, item, item.type); }}
                                className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors group border-b border-slate-50 dark:border-slate-800/50"
                            >
                                <div className="col-span-6 flex items-center gap-3 min-w-0">
                                    <Icon size={20} className={iconColor} />
                                    <span className="truncate font-medium text-slate-700 dark:text-slate-200">{item.name}</span>
                                    {item.starred && !isTrashView && <Star size={14} className="text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                                </div>
                                <div className="col-span-2 text-sm text-slate-500 dark:text-slate-400">
                                    {isFolder ? '—' : formatBytes(item.size)}
                                </div>
                                <div className="col-span-3 text-sm text-slate-400 dark:text-slate-500">
                                    {item.date ? new Date(item.date).toLocaleDateString() : '—'}
                                </div>
                                <div className="col-span-1 flex justify-end">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onContextMenu?.(e, item, item.type); }}
                                        className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        );
    }

    // Grid View
    return (
        <div className="grid gap-4 p-6 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            <AnimatePresence mode="popLayout">
                {getSortedItems(allItems).map((item, index) => (
                    <FileCard
                        key={item.id}
                        item={item}
                        index={index}
                        type={item.type || (item.size ? 'file' : 'folder')}
                        viewMode={viewMode}
                        onNavigate={onNavigate}
                        onAction={onAction}
                        onMove={onMove}
                        onContextMenu={onContextMenu}
                        isTrashView={isTrashView}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
};

export default FileGrid;