import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, XCircle, Folder, Eye, Download, Star, Share2, Info, Trash2, Lock } from 'lucide-react';

const ContextMenu = ({ x, y, item, type, onClose, onAction, isTrashView }) => {

    const MenuBtn = ({ icon: Icon, label, onClick, color = "text-white/70" }) => (
        <motion.button
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            whileHover={{ x: 4, backgroundColor: 'rgba(99, 102, 241, 0.15)' }}
            onClick={() => { onClick(); onClose(); }}
            className={`w-full text-left px-4 py-2.5 text-sm ${color} transition-all flex items-center gap-3 rounded-lg mx-1`}
        >
            <Icon size={16} />
            <span>{label}</span>
        </motion.button>
    );

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed z-50 w-56 py-2 overflow-hidden"
            style={{
                top: y,
                left: x,
                background: 'rgba(15, 15, 25, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 16,
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05) inset'
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-white/10 mb-1">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{type}</p>
                <p className="text-sm font-medium text-white/90 truncate mt-0.5">{item.name}</p>
            </div>

            {isTrashView ? (
                <>
                    <MenuBtn icon={RefreshCw} label="Restore" onClick={() => onAction('restore', item)} color="text-green-400" />
                    <MenuBtn icon={XCircle} label="Delete Forever" onClick={() => onAction('permanentDelete', item)} color="text-red-400" />
                </>
            ) : (
                <>
                    {type === 'folder' ? (
                        <MenuBtn icon={Folder} label="Open" onClick={() => onAction('open', item)} />
                    ) : (
                        <MenuBtn icon={Eye} label="Preview" onClick={() => onAction('preview', item)} />
                    )}

                    <MenuBtn
                        icon={Download}
                        label={type === 'folder' ? "Download as Zip" : "Download"}
                        onClick={() => onAction('download', item)}
                    />

                    <div className="h-px bg-white/5 my-1" />

                    <MenuBtn icon={Star} label={item.starred ? 'Remove Star' : 'Add Star'} onClick={() => onAction('star', item)} />
                    <MenuBtn icon={Lock} label={item.vault ? 'Remove from Vault' : 'Move to Vault'} onClick={() => onAction('vault', item)} />
                    <MenuBtn icon={Share2} label="Share" onClick={() => onAction('share', item)} />
                    <MenuBtn icon={Info} label="Properties" onClick={() => onAction('info', item)} />

                    <div className="h-px bg-white/5 my-1" />

                    <MenuBtn icon={Trash2} label="Move to Trash" onClick={() => onAction('trash', item)} color="text-red-400" />
                </>
            )}
        </motion.div>
    );
};

export default ContextMenu;