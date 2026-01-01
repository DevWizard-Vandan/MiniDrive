import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, XCircle, Folder, File, Download, Star, Share2, Info, Trash2 } from 'lucide-react';

const ContextMenu = ({ x, y, item, type, onClose, onAction, isTrashView }) => {

    const MenuBtn = ({ icon: Icon, label, onClick, color = "text-slate-700 dark:text-slate-200" }) => (
        <motion.button
            whileHover={{ x: 4 }}
            onClick={() => { onClick(); onClose(); }}
            className={`w-full text-left px-4 py-2.5 text-sm ${color} hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all flex items-center gap-3`}
        >
            <Icon size={16} /> {label}
        </motion.button>
    );

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed z-50 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-slate-900/20 dark:shadow-black/40 border border-slate-200/50 dark:border-slate-700/50 w-56 py-2 overflow-hidden"
            style={{ top: y, left: x }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 mb-1 bg-slate-50/50 dark:bg-slate-900/50">
                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate uppercase tracking-wider">{type}</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{item.name}</p>
            </div>

            {isTrashView ? (
                <>
                    <MenuBtn icon={RefreshCw} label="Restore" onClick={() => onAction('restore', item)} color="text-green-600 dark:text-green-400" />
                    <MenuBtn icon={XCircle} label="Delete Forever" onClick={() => onAction('permanentDelete', item)} color="text-red-600 dark:text-red-400" />
                </>
            ) : (
                <>
                    {type === 'folder'
                        ? <MenuBtn icon={Folder} label="Open" onClick={() => onAction('open', item)} />
                        : <MenuBtn icon={File} label="Preview" onClick={() => onAction('preview', item)} />
                    }

                    <MenuBtn
                        icon={Download}
                        label={type === 'folder' ? "Download as Zip" : "Download"}
                        onClick={() => onAction('download', item)}
                    />

                    <MenuBtn icon={Star} label={item.starred ? 'Unstar' : 'Add to Starred'} onClick={() => onAction('star', item)} />
                    <MenuBtn icon={Share2} label="Share" onClick={() => onAction('share', item)} />
                    <MenuBtn icon={Info} label="Properties" onClick={() => onAction('info', item)} />

                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />

                    <MenuBtn icon={Trash2} label="Move to Trash" onClick={() => onAction('trash', item)} color="text-red-600 dark:text-red-400" />
                </>
            )}
        </motion.div>
    );
};

export default ContextMenu;