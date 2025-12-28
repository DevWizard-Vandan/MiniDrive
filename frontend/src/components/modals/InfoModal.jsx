import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, File, Calendar, HardDrive } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import { formatBytes } from '../../utils/helpers';

const InfoModal = ({ file, onClose }) => {
    return (
        <AnimatePresence>
            {file && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
                        <GlassCard className="p-6 w-96 !bg-white/90">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-lg text-slate-800">Properties</h3>
                                <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                            </div>

                            <div className="flex items-center gap-4 p-4 bg-white/50 rounded-xl border border-white/50 mb-6 shadow-sm">
                                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                                    <File size={24} />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="font-bold text-slate-700 truncate" title={file.name}>{file.name}</p>
                                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{file.type || 'File'}</p>
                                </div>
                            </div>

                            <div className="space-y-4 text-sm text-slate-600">
                                <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors">
                                    <div className="flex items-center gap-2 text-slate-400"><HardDrive size={16} /> <span>Size</span></div>
                                    <span className="font-semibold text-slate-700">{formatBytes(file.size || 0)}</span>
                                </div>
                                <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors">
                                    <div className="flex items-center gap-2 text-slate-400"><Calendar size={16} /> <span>Created</span></div>
                                    <span className="font-semibold text-slate-700">{new Date(file.date).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </GlassCard>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default InfoModal;