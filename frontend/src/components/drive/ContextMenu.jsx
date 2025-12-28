import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, XCircle, Folder, File, Download, Star, Share2, Info, Trash2 } from 'lucide-react';

const ContextMenu = ({ x, y, item, type, onClose, onAction, isTrashView }) => {
    const MenuBtn = ({ icon: Icon, label, onClick, color = "text-slate-700" }) => (
        <button onClick={() => { onClick(); onClose(); }} className={`w-full text-left px-4 py-2.5 text-sm ${color} hover:bg-indigo-50 hover:pl-6 transition-all flex items-center gap-3`}>
            <Icon size={16} /> {label}
        </button>
    );

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed z-50 bg-white/90 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 w-56 py-2 overflow-hidden"
            style={{ top: y, left: x }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="px-4 py-2 border-b border-gray-100 mb-1 bg-gray-50/50">
                <p className="text-xs font-bold text-indigo-600 truncate uppercase tracking-wider">{type}</p>
                <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
            </div>

            {isTrashView ? (
                <>
                    <MenuBtn icon={RefreshCw} label="Restore" onClick={() => onAction('restore', item)} color="text-green-600" />
                    <MenuBtn icon={XCircle} label="Delete Forever" onClick={() => onAction('permanentDelete', item)} color="text-red-600" />
                </>
            ) : (
                <>
                    {type === 'folder' && <MenuBtn icon={Folder} label="Open" onClick={() => onAction('open', item)} />}
                    {type !== 'folder' && <MenuBtn icon={File} label="Preview" onClick={() => onAction('preview', item)} />}
                    <MenuBtn icon={Download} label="Download" onClick={() => onAction('download', item)} />
                    <MenuBtn icon={Star} label={item.starred ? 'Unstar' : 'Add to Starred'} onClick={() => onAction('star', item)} />
                    <MenuBtn icon={Share2} label="Share" onClick={() => onAction('share', item)} />
                    <MenuBtn icon={Info} label="Properties" onClick={() => onAction('info', item)} />
                    <div className="h-px bg-slate-100 my-1" />
                    <MenuBtn icon={Trash2} label="Move to Trash" onClick={() => onAction('trash', item)} color="text-red-600" />
                </>
            )}
        </motion.div>
    );
};

export default ContextMenu;