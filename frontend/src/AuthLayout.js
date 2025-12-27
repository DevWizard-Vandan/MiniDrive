import React from 'react';
import { motion } from 'framer-motion';

const AuthLayout = ({ children, title, subtitle }) => {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-4xl w-full flex min-h-[600px]">

                {/* Left: Content / Form */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full md:w-1/2 p-12 flex flex-col justify-center relative z-10"
                >
                    <div className="mb-8">
                        <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4">M</div>
                        <h1 className="text-3xl font-bold text-slate-800 mb-2">{title}</h1>
                        <p className="text-slate-500">{subtitle}</p>
                    </div>
                    {children}
                </motion.div>

                {/* Right: Abstract Visual */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8 }}
                    className="hidden md:flex w-1/2 bg-indigo-600 relative items-center justify-center overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-700 opacity-90" />
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="w-96 h-96 border border-white/20 rounded-full absolute -top-20 -right-20"
                    />
                    <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                        className="w-[500px] h-[500px] border border-white/10 rounded-full absolute -bottom-40 -left-20"
                    />
                    <div className="relative z-10 text-white p-12">
                        <h2 className="text-4xl font-bold mb-6">Secure Cloud Storage</h2>
                        <p className="text-indigo-100 text-lg leading-relaxed">
                            Store, share, and collaborate on files and folders from any mobile device, tablet, or computer.
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default AuthLayout;