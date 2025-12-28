import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud } from 'lucide-react';

const UploadProgress = ({ progress }) => {
    return (
        <AnimatePresence>
            {progress > 0 && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-6 right-6 z-[100]"
                >
                    <div className="bg-slate-900/90 backdrop-blur-xl text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 w-80 border border-white/10">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
                            <UploadCloud size={20} className="animate-bounce" />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between mb-1 text-xs font-bold text-slate-300">
                                <span>Uploading...</span><span>{progress}%</span>
                            </div>
                            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    className="bg-indigo-400 h-full shadow-[0_0_10px_rgba(129,140,248,0.5)]"
                                />
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default UploadProgress;