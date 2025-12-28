import React from 'react';
import { motion } from 'framer-motion';

const GlassCard = ({ children, className = "", hoverEffect = false, ...props }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`
                relative overflow-hidden
                bg-white/40 dark:bg-slate-900/40 
                backdrop-blur-xl 
                border border-white/20 dark:border-white/10
                shadow-xl
                rounded-2xl
                ${hoverEffect ? 'hover:bg-white/50 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1' : ''}
                ${className}
            `}
            {...props}
        >
            {/* Noise Texture for realism */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0"
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
            />
            <div className="relative z-10">
                {children}
            </div>
        </motion.div>
    );
};

export default GlassCard;