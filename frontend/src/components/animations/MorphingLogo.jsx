import React from 'react';
import { motion } from 'framer-motion';
import { Cloud } from 'lucide-react';

/**
 * Morphing animated logo with SVG path transitions.
 * Creates an eye-catching brand presence.
 */
const MorphingLogo = ({ size = 'md', animate = true, showText = true }) => {
    const sizes = {
        sm: { icon: 24, text: 'text-lg' },
        md: { icon: 32, text: 'text-xl' },
        lg: { icon: 48, text: 'text-3xl' },
        xl: { icon: 64, text: 'text-4xl' }
    };

    const s = sizes[size] || sizes.md;

    const containerVariants = {
        initial: { scale: 0.8, opacity: 0 },
        animate: {
            scale: 1,
            opacity: 1,
            transition: { type: 'spring', stiffness: 200, damping: 15 }
        },
        hover: {
            scale: 1.05,
            transition: { type: 'spring', stiffness: 400, damping: 10 }
        }
    };

    const cloudVariants = {
        animate: {
            y: [0, -5, 0],
            rotate: [0, 2, -2, 0],
            transition: {
                y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
                rotate: { duration: 4, repeat: Infinity, ease: 'easeInOut' }
            }
        }
    };

    const shimmerVariants = {
        animate: {
            x: ['-100%', '200%'],
            transition: {
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3
            }
        }
    };

    const letterVariants = {
        initial: { y: 20, opacity: 0 },
        animate: (i) => ({
            y: 0,
            opacity: 1,
            transition: { delay: i * 0.05, type: 'spring', stiffness: 300, damping: 20 }
        }),
        hover: {
            y: -3,
            color: '#8b5cf6',
            transition: { type: 'spring', stiffness: 400, damping: 10 }
        }
    };

    const brandName = 'SanchayCloud';

    return (
        <motion.div
            className="flex items-center gap-3 cursor-pointer select-none"
            variants={containerVariants}
            initial="initial"
            animate="animate"
            whileHover="hover"
        >
            {/* Animated Icon Container */}
            <motion.div
                className="relative"
                variants={animate ? cloudVariants : undefined}
                animate={animate ? 'animate' : undefined}
            >
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl blur-lg opacity-50" />

                {/* Icon background */}
                <div className="relative p-3 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl shadow-lg overflow-hidden">
                    {/* Shimmer overlay */}
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                        variants={shimmerVariants}
                        animate={animate ? 'animate' : undefined}
                    />

                    <Cloud size={s.icon} className="text-white relative z-10" strokeWidth={2.5} />
                </div>
            </motion.div>

            {/* Animated Text */}
            {showText && (
                <div className={`font-bold ${s.text} flex`}>
                    {brandName.split('').map((letter, i) => (
                        <motion.span
                            key={i}
                            custom={i}
                            variants={letterVariants}
                            initial="initial"
                            animate="animate"
                            whileHover="hover"
                            className={`inline-block ${i < 7
                                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400'
                                    : 'text-slate-700 dark:text-slate-300'
                                }`}
                        >
                            {letter}
                        </motion.span>
                    ))}
                </div>
            )}
        </motion.div>
    );
};

export default MorphingLogo;
