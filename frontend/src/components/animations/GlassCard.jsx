import React from 'react';
import { motion } from 'framer-motion';

/**
 * Glassmorphic card component with frosted glass effect.
 * Supports hover animations and customizable blur levels.
 */
const GlassCard = ({
    children,
    className = '',
    blur = 'lg',
    hoverEffect = true,
    glowColor = 'indigo',
    animated = true,
    onClick
}) => {
    const blurValues = {
        sm: 'backdrop-blur-sm',
        md: 'backdrop-blur-md',
        lg: 'backdrop-blur-lg',
        xl: 'backdrop-blur-xl',
        '2xl': 'backdrop-blur-2xl'
    };

    const glowColors = {
        indigo: 'hover:shadow-[0_0_40px_rgba(99,102,241,0.3)]',
        purple: 'hover:shadow-[0_0_40px_rgba(139,92,246,0.3)]',
        pink: 'hover:shadow-[0_0_40px_rgba(236,72,153,0.3)]',
        cyan: 'hover:shadow-[0_0_40px_rgba(34,211,238,0.3)]',
        emerald: 'hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]'
    };

    const baseClasses = `
        relative overflow-hidden rounded-2xl
        bg-white/70 dark:bg-slate-900/70
        ${blurValues[blur] || blurValues.lg}
        border border-white/20 dark:border-white/10
        shadow-lg shadow-slate-900/5 dark:shadow-slate-900/20
        ${hoverEffect ? glowColors[glowColor] || glowColors.indigo : ''}
        transition-all duration-300
    `;

    const Wrapper = animated ? motion.div : 'div';
    const animationProps = animated ? {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        whileHover: hoverEffect ? { y: -5, scale: 1.01 } : undefined,
        transition: { type: 'spring', stiffness: 300, damping: 25 }
    } : {};

    return (
        <Wrapper
            className={`${baseClasses} ${className}`}
            onClick={onClick}
            {...animationProps}
        >
            {/* Gradient shimmer overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

            {/* Content */}
            <div className="relative z-10">
                {children}
            </div>

            {/* Animated border glow */}
            {hoverEffect && (
                <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div className="absolute inset-[-1px] rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20 blur-sm" />
                </div>
            )}
        </Wrapper>
    );
};

/**
 * Glass button with ripple effect.
 */
export const GlassButton = ({
    children,
    className = '',
    variant = 'primary',
    size = 'md',
    icon,
    onClick
}) => {
    const variants = {
        primary: 'bg-white/20 hover:bg-white/30 text-white',
        secondary: 'bg-slate-100/20 hover:bg-slate-100/30 text-slate-800 dark:text-white',
        danger: 'bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-400'
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2',
        lg: 'px-6 py-3 text-lg'
    };

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={`
                relative overflow-hidden rounded-xl
                backdrop-blur-md border border-white/20
                ${variants[variant]} ${sizes[size]}
                font-medium transition-all duration-200
                flex items-center justify-center gap-2
                ${className}
            `}
        >
            {icon && <span className="flex-shrink-0">{icon}</span>}
            {children}

            {/* Ripple effect overlay */}
            <span className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity duration-300" />
        </motion.button>
    );
};

/**
 * Glass panel for larger content areas.
 */
export const GlassPanel = ({ children, className = '' }) => (
    <div className={`
        rounded-3xl p-6
        bg-white/50 dark:bg-slate-900/50
        backdrop-blur-xl
        border border-white/30 dark:border-white/10
        shadow-2xl shadow-slate-900/10 dark:shadow-slate-900/30
        ${className}
    `}>
        {children}
    </div>
);

export default GlassCard;
