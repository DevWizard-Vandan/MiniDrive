import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download } from 'lucide-react';

const PreviewModal = ({ file, onClose, onDownload }) => {
    if (!file) return null;

    const token = localStorage.getItem('token');
    const fileUrl = `http://localhost:8080/api/drive/view/${file.name}?token=${token}`;
    const ext = file.name.split('.').pop().toLowerCase();

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-b from-black/50 to-transparent">
                    <h3 className="text-white font-medium truncate max-w-2xl text-lg">{file.name}</h3>
                    <div className="flex gap-4">
                        <button onClick={() => onDownload(file)} className="text-white/70 hover:text-white flex items-center gap-2 px-4 py-2 rounded-full hover:bg-white/10 transition-all">
                            <Download size={20} /> <span className="hidden sm:inline">Download</span>
                        </button>
                        <button onClick={onClose} className="text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-all">
                            <X size={28} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
                    {['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) && (
                        <img src={fileUrl} alt="Preview" className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />
                    )}
                    {['mp4', 'webm', 'mov'].includes(ext) && (
                        <video controls autoPlay className="max-h-full max-w-full rounded-lg shadow-2xl outline-none">
                            <source src={fileUrl} type="video/mp4" />
                        </video>
                    )}
                    {['pdf'].includes(ext) && (
                        <iframe src={fileUrl} className="w-full h-full max-w-5xl bg-white rounded-lg shadow-2xl" title="PDF Preview" />
                    )}
                    {!['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'pdf'].includes(ext) && (
                        <div className="text-white text-center">
                            <p className="text-xl mb-4">Preview not available</p>
                            <button onClick={() => onDownload(file)} className="px-6 py-3 bg-indigo-600 rounded-xl font-bold">Download File</button>
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default PreviewModal;