import React from 'react';
import { motion } from 'framer-motion';

/**
 * Liquid morphing loader - premium loading animation
 */
export const LiquidLoader = ({ size = 'md', text = '' }) => {
    const sizes = {
        sm: { container: 40, blob: 8 },
        md: { container: 60, blob: 12 },
        lg: { container: 80, blob: 16 },
    };
    const s = sizes[size] || sizes.md;

    return (
        <div className="flex flex-col items-center justify-center gap-4">
            <div
                className="relative"
                style={{ width: s.container, height: s.container }}
            >
                {/* Orbiting blobs */}
                {[0, 1, 2, 3].map((i) => (
                    <motion.div
                        key={i}
                        className="absolute rounded-full"
                        style={{
                            width: s.blob,
                            height: s.blob,
                            background: `linear-gradient(135deg, 
                                ${i === 0 ? '#6366f1' : i === 1 ? '#8b5cf6' : i === 2 ? '#ec4899' : '#06b6d4'}, 
                                ${i === 0 ? '#8b5cf6' : i === 1 ? '#ec4899' : i === 2 ? '#06b6d4' : '#6366f1'})`,
                            boxShadow: '0 0 20px currentColor',
                            left: '50%',
                            top: '50%',
                        }}
                        animate={{
                            x: [
                                Math.cos((i * Math.PI) / 2) * (s.container / 2 - s.blob),
                                Math.cos((i * Math.PI) / 2 + Math.PI / 2) * (s.container / 2 - s.blob),
                                Math.cos((i * Math.PI) / 2 + Math.PI) * (s.container / 2 - s.blob),
                                Math.cos((i * Math.PI) / 2 + (3 * Math.PI) / 2) * (s.container / 2 - s.blob),
                                Math.cos((i * Math.PI) / 2) * (s.container / 2 - s.blob),
                            ],
                            y: [
                                Math.sin((i * Math.PI) / 2) * (s.container / 2 - s.blob),
                                Math.sin((i * Math.PI) / 2 + Math.PI / 2) * (s.container / 2 - s.blob),
                                Math.sin((i * Math.PI) / 2 + Math.PI) * (s.container / 2 - s.blob),
                                Math.sin((i * Math.PI) / 2 + (3 * Math.PI) / 2) * (s.container / 2 - s.blob),
                                Math.sin((i * Math.PI) / 2) * (s.container / 2 - s.blob),
                            ],
                            scale: [1, 1.2, 1, 0.8, 1],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: i * 0.1,
                        }}
                    />
                ))}

                {/* Center pulse */}
                <motion.div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500"
                    style={{ width: s.blob * 2, height: s.blob * 2 }}
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.8, 0.4, 0.8],
                    }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
            </div>

            {text && (
                <motion.p
                    className="text-white/50 text-sm font-medium"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    {text}
                </motion.p>
            )}
        </div>
    );
};

/**
 * Morphing logo loader
 */
export const LogoLoader = ({ size = 60 }) => (
    <div className="flex flex-col items-center gap-4">
        <motion.div
            className="relative"
            style={{ width: size, height: size }}
        >
            {/* Outer ring */}
            <motion.div
                className="absolute inset-0 rounded-xl border-2 border-indigo-500/30"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />

            {/* Inner morphing shape */}
            <motion.div
                className="absolute inset-2 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-lg"
                animate={{
                    borderRadius: ['20%', '50%', '30%', '50%', '20%'],
                    rotate: [0, 90, 180, 270, 360],
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
            />

            {/* Glow */}
            <motion.div
                className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl blur-xl"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
            />
        </motion.div>

        <motion.div
            className="flex gap-1"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
        >
            {['S', 'a', 'n', 'c', 'h', 'a', 'y'].map((letter, i) => (
                <motion.span
                    key={i}
                    className="text-white/60 font-bold"
                    initial={{ y: 0 }}
                    animate={{ y: [-2, 2, -2] }}
                    transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: i * 0.05,
                    }}
                >
                    {letter}
                </motion.span>
            ))}
        </motion.div>
    </div>
);

/**
 * Skeleton with wave shimmer
 */
export const WaveSkeleton = ({ className = '', variant = 'text' }) => {
    const variants = {
        text: 'h-4 rounded',
        title: 'h-6 rounded w-3/4',
        avatar: 'w-12 h-12 rounded-full',
        card: 'h-32 rounded-xl',
        thumbnail: 'aspect-square rounded-xl',
    };

    return (
        <div className={`relative overflow-hidden bg-white/5 ${variants[variant]} ${className}`}>
            <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
        </div>
    );
};

/**
 * Full page loading screen
 */
export const FullPageLoader = () => (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0f] flex items-center justify-center">
        {/* Background gradient */}
        <div className="absolute inset-0 overflow-hidden">
            <motion.div
                className="absolute w-96 h-96 bg-indigo-600/30 rounded-full blur-3xl"
                animate={{
                    x: ['-50%', '50%', '-50%'],
                    y: ['-50%', '50%', '-50%'],
                }}
                transition={{ duration: 10, repeat: Infinity }}
                style={{ top: '20%', left: '30%' }}
            />
            <motion.div
                className="absolute w-96 h-96 bg-purple-600/30 rounded-full blur-3xl"
                animate={{
                    x: ['50%', '-50%', '50%'],
                    y: ['50%', '-50%', '50%'],
                }}
                transition={{ duration: 12, repeat: Infinity }}
                style={{ bottom: '20%', right: '30%' }}
            />
        </div>

        <LogoLoader size={80} />
    </div>
);

export default LiquidLoader;
