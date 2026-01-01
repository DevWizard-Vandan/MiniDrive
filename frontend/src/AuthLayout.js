import React from 'react';
import { motion } from 'framer-motion';
import { Cloud, Sparkles } from 'lucide-react';
import logo from './assets/logo.png';

const AuthLayout = ({ children, title, subtitle }) => {
    return (
        <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-indigo-950 dark:to-purple-950 transition-colors duration-500">

            {/* Animated Background Blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        x: [0, 30, 0],
                        y: [0, -50, 0],
                        scale: [1, 1.1, 1]
                    }}
                    transition={{ repeat: Infinity, duration: 7 }}
                    className="absolute top-20 left-20 w-72 h-72 bg-indigo-300/30 dark:bg-indigo-600/20 rounded-full blur-3xl"
                />
                <motion.div
                    animate={{
                        x: [0, -30, 0],
                        y: [0, 30, 0],
                        scale: [1, 1.2, 1]
                    }}
                    transition={{ repeat: Infinity, duration: 9, delay: 2 }}
                    className="absolute bottom-20 right-20 w-96 h-96 bg-purple-300/30 dark:bg-purple-600/20 rounded-full blur-3xl"
                />
                <motion.div
                    animate={{
                        x: [0, 20, 0],
                        y: [0, -20, 0],
                        scale: [1, 0.9, 1]
                    }}
                    transition={{ repeat: Infinity, duration: 8, delay: 4 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-300/20 dark:bg-pink-600/10 rounded-full blur-3xl"
                />
            </div>

            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 opacity-90 dark:opacity-80" />

                {/* Floating Elements */}
                <div className="absolute inset-0">
                    <motion.div
                        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
                        transition={{ repeat: Infinity, duration: 5 }}
                        className="absolute top-20 left-20"
                    >
                        <Cloud size={40} className="text-white/20" />
                    </motion.div>
                    <motion.div
                        animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }}
                        transition={{ repeat: Infinity, duration: 6, delay: 1 }}
                        className="absolute bottom-32 right-20"
                    >
                        <Cloud size={60} className="text-white/20" />
                    </motion.div>
                    <motion.div
                        animate={{ y: [0, -15, 0] }}
                        transition={{ repeat: Infinity, duration: 4, delay: 2 }}
                        className="absolute top-1/3 right-1/4"
                    >
                        <Sparkles size={24} className="text-white/30" />
                    </motion.div>
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center justify-center w-full px-12 text-white">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-center"
                    >
                        <motion.div
                            animate={{ rotate: [0, 360] }}
                            transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                            className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-white/10 backdrop-blur-xl flex items-center justify-center shadow-2xl"
                        >
                            <img src={logo} alt="SanchayCloud" className="w-16 h-16 object-contain" />
                        </motion.div>

                        <h1 className="text-5xl font-bold mb-4 tracking-tight">SanchayCloud</h1>
                        <p className="text-xl text-white/80 max-w-md mx-auto leading-relaxed">
                            Your files, everywhere. Secure cloud storage with blazing fast uploads.
                        </p>

                        {/* Feature Pills */}
                        <div className="flex flex-wrap justify-center gap-3 mt-8">
                            {['1TB Free', 'E2E Encrypted', 'File Sharing', 'Smart Sync'].map((feature, i) => (
                                <motion.span
                                    key={feature}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 + i * 0.1 }}
                                    className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium border border-white/20"
                                >
                                    {feature}
                                </motion.span>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="flex-1 flex items-center justify-center p-8 relative z-10">
                <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                    className="w-full max-w-md"
                >
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                            <img src={logo} alt="SanchayCloud" className="w-8 h-8 object-contain" />
                        </div>
                        <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            SanchayCloud
                        </span>
                    </div>

                    {/* Form Card */}
                    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-indigo-500/10 dark:shadow-black/20 border border-white/50 dark:border-slate-700/50">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{title}</h2>
                            <p className="text-slate-500 dark:text-slate-400">{subtitle}</p>
                        </div>

                        {children}
                    </div>

                    {/* Footer */}
                    <p className="text-center text-slate-400 dark:text-slate-500 text-sm mt-6">
                        © 2026 SanchayCloud. All rights reserved.
                    </p>
                </motion.div>
            </div>
        </div>
    );
};

export default AuthLayout;