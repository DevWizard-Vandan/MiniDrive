import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../ui/GlassCard';

const CreateFolderModal = ({ isOpen, onClose, onCreate }) => {
    const [name, setName] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        onCreate(name);
        setName("");
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                        <GlassCard className="p-6 w-80 !bg-white/90">
                            <h3 className="font-bold text-lg mb-4 text-slate-800">New Folder</h3>
                            <form onSubmit={handleSubmit}>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Folder Name"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                                <div className="flex justify-end gap-2">
                                    <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">Create</button>
                                </div>
                            </form>
                        </GlassCard>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default CreateFolderModal;