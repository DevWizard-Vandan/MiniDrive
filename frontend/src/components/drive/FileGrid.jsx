import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UploadCloud } from 'lucide-react';
import FileCard from './FileCard';

const FileGrid = ({
                      folders, files,
                      viewMode, sortBy,
                      onNavigate, onAction, onMove, onContextMenu,
                      isTrashView
                  }) => {

    const getSortedItems = (items) => {
        let sorted = [...items];
        if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
        else if (sortBy === 'size') sorted.sort((a, b) => (b.size || 0) - (a.size || 0));
        else sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
        return sorted;
    };

    if (folders.length === 0 && files.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-60 pb-20">
                <div className="w-32 h-32 bg-indigo-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <UploadCloud size={64} className="text-indigo-200" />
                </div>
                <h3 className="text-xl font-bold text-slate-600">It's empty here</h3>
                <p className="text-slate-400">Upload a file or create a folder to get started</p>
            </div>
        );
    }

    return (
        <div className={`
            grid gap-6 pb-20 p-8 overflow-y-auto custom-scrollbar
            ${viewMode === 'grid'
            ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
            : 'grid-cols-1'
        }
        `}>
            <AnimatePresence mode="popLayout">
                {getSortedItems(folders).map((f) => (
                    <FileCard
                        key={f.id} item={f} type="folder"
                        onNavigate={onNavigate} onAction={onAction} onMove={onMove}
                        onContextMenu={onContextMenu} isTrashView={isTrashView}
                    />
                ))}
                {getSortedItems(files).map((f) => (
                    <FileCard
                        key={f.id} item={f} type="file"
                        onAction={onAction} onMove={onMove}
                        onContextMenu={onContextMenu} isTrashView={isTrashView}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
};

export default FileGrid;