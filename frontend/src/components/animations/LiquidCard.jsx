import React, { useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Liquid motion card with organic blob morphing on hover.
 * Creates fluid, playful interactions.
 */
const LiquidCard = ({
    children,
    className = '',
    color = 'indigo',
    onClick
}) => {
    const [isHovered, setIsHovered] = useState(false);

    const colors = {
        indigo: { from: '#6366f1', to: '#8b5cf6' },
        purple: { from: '#8b5cf6', to: '#ec4899' },
        pink: { from: '#ec4899', to: '#f43f5e' },
        cyan: { from: '#06b6d4', to: '#6366f1' },
        emerald: { from: '#10b981', to: '#06b6d4' }
    };

    const c = colors[color] || colors.indigo;

    const blobVariants = {
        idle: {
            d: "M60,-60C80,-40,100,-20,100,0C100,20,80,40,60,60C40,80,20,100,0,100C-20,100,-40,80,-60,60C-80,40,-100,20,-100,0C-100,-20,-80,-40,-60,-60C-40,-80,-20,-100,0,-100C20,-100,40,-80,60,-60Z"
        },
        hover: {
            d: "M70,-50C85,-25,90,-5,80,20C70,45,45,70,15,80C-15,90,-50,85,-70,65C-90,45,-95,10,-85,-20C-75,-50,-50,-75,-20,-85C10,-95,55,-75,70,-50Z",
            transition: { duration: 0.8, ease: "easeInOut" }
        }
    };

    return (
        <motion.div
            className={`relative overflow-hidden rounded-2xl ${className}`}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            onClick={onClick}
            whileHover={{ scale: 1.02, y: -5 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
            {/* Animated blob background */}
            <div className="absolute inset-0 overflow-hidden">
                <svg
                    className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2"
                    viewBox="-100 -100 200 200"
                >
                    <defs>
                        <linearGradient id={`liquid-grad-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={c.from} />
                            <stop offset="100%" stopColor={c.to} />
                        </linearGradient>
                        <filter id="liquid-blur">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
                        </filter>
                    </defs>

                    <motion.path
                        fill={`url(#liquid-grad-${color})`}
                        opacity={0.15}
                        variants={blobVariants}
                        animate={isHovered ? 'hover' : 'idle'}
                        style={{ filter: 'url(#liquid-blur)' }}
                    />
                </svg>
            </div>

            {/* Card content */}
            <div className="relative z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-6 rounded-2xl border border-white/20 dark:border-white/10">
                {children}
            </div>

            {/* Shimmer effect on hover */}
            <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none"
                initial={{ x: '-100%' }}
                animate={{ x: isHovered ? '200%' : '-100%' }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
            />
        </motion.div>
    );
};

/**
 * Liquid button with ripple effect.
 */
export const LiquidButton = ({
    children,
    onClick,
    color = 'indigo',
    className = ''
}) => {
    const [ripples, setRipples] = useState([]);

    const handleClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const newRipple = { x, y, id: Date.now() };
        setRipples([...ripples, newRipple]);

        setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== newRipple.id));
        }, 1000);

        onClick?.(e);
    };

    const colors = {
        indigo: 'from-indigo-500 to-purple-500',
        pink: 'from-pink-500 to-rose-500',
        cyan: 'from-cyan-500 to-blue-500',
        emerald: 'from-emerald-500 to-teal-500'
    };

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClick}
            className={`
                relative overflow-hidden px-6 py-3 rounded-xl
                bg-gradient-to-r ${colors[color] || colors.indigo}
                text-white font-medium
                shadow-lg shadow-indigo-500/30
                ${className}
            `}
        >
            {/* Ripples */}
            {ripples.map(ripple => (
                <motion.span
                    key={ripple.id}
                    initial={{ scale: 0, opacity: 0.5 }}
                    animate={{ scale: 4, opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute w-20 h-20 bg-white/30 rounded-full pointer-events-none"
                    style={{
                        left: ripple.x - 40,
                        top: ripple.y - 40
                    }}
                />
            ))}

            <span className="relative z-10">{children}</span>
        </motion.button>
    );
};

export default LiquidCard;
