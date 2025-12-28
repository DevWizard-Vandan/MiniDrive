import React from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, FolderSearch, Sparkles } from 'lucide-react';

const EmptyState = ({ type = 'empty', searchQuery = '' }) => {
    const states = {
        empty: {
            icon: UploadCloud,
            title: 'Drop files here',
            description: 'or click the Upload button to add files to your drive',
            gradient: 'from-indigo-500 to-purple-500',
        },
        search: {
            icon: FolderSearch,
            title: 'No results found',
            description: `We couldn't find anything matching "${searchQuery}"`,
            gradient: 'from-slate-400 to-slate-500',
        },
        trash: {
            icon: Sparkles,
            title: 'Trash is empty',
            description: 'Items you delete will appear here',
            gradient: 'from-emerald-500 to-teal-500',
        },
    };

    const config = states[type] || states.empty;
    const Icon = config.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 px-4"
        >
            {/* Animated icon container */}
            <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="relative mb-8"
            >
                {/* Gradient glow */}
                <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${config.gradient} opacity-20 blur-2xl scale-150`} />

                {/* Icon background */}
                <div className={`relative w-32 h-32 rounded-3xl bg-gradient-to-br ${config.gradient} p-[2px] shadow-2xl`}>
                    <div className="w-full h-full rounded-3xl bg-white dark:bg-slate-900 flex items-center justify-center">
                        <motion.div
                            animate={{ rotate: [0, 5, -5, 0] }}
                            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            <Icon size={48} className={`bg-gradient-to-r ${config.gradient} bg-clip-text`} style={{ color: 'transparent', background: `linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to))`, WebkitBackgroundClip: 'text' }} />
                        </motion.div>
                    </div>
                </div>

                {/* Floating particles */}
                {[...Array(3)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-2 h-2 rounded-full bg-indigo-400"
                        style={{
                            top: `${20 + i * 20}%`,
                            left: i % 2 === 0 ? '-10%' : '110%',
                        }}
                        animate={{
                            y: [0, -20, 0],
                            opacity: [0.5, 1, 0.5],
                            scale: [1, 1.2, 1],
                        }}
                        transition={{
                            duration: 2 + i,
                            repeat: Infinity,
                            delay: i * 0.3,
                        }}
                    />
                ))}
            </motion.div>

            {/* Text content */}
            <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-3"
            >
                {config.title}
            </motion.h3>

            <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-slate-500 dark:text-slate-400 text-center max-w-md"
            >
                {config.description}
            </motion.p>

            {/* Action hint for empty state */}
            {type === 'empty' && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-8 flex items-center gap-2 text-sm text-slate-400"
                >
                    <div className="flex items-center gap-1">
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md shadow-sm font-mono text-xs">
                            ⌘
                        </kbd>
                        <span>+</span>
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md shadow-sm font-mono text-xs">
                            U
                        </kbd>
                    </div>
                    <span>to upload</span>
                </motion.div>
            )}
        </motion.div>
    );
};

export default EmptyState;