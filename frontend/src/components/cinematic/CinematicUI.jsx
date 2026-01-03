import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

/**
 * Cinematic mesh gradient background with fluid motion.
 * Creates an alive, breathing atmosphere.
 */
const MeshGradientBackground = ({ className = '' }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let animationId;
        let time = 0;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        // Gradient orbs with physics
        const orbs = [
            { x: 0.3, y: 0.3, radius: 0.4, color: [99, 102, 241], speed: 0.0003 },
            { x: 0.7, y: 0.7, radius: 0.5, color: [139, 92, 246], speed: 0.0004 },
            { x: 0.5, y: 0.2, radius: 0.35, color: [236, 72, 153], speed: 0.0002 },
            { x: 0.2, y: 0.8, radius: 0.45, color: [6, 182, 212], speed: 0.00035 },
        ];

        const animate = () => {
            time += 1;

            // Dark base
            ctx.fillStyle = '#0a0a0f';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw fluid orbs
            orbs.forEach((orb, i) => {
                const offsetX = Math.sin(time * orb.speed + i * 1.5) * 0.15;
                const offsetY = Math.cos(time * orb.speed * 0.7 + i * 2) * 0.15;

                const x = (orb.x + offsetX) * canvas.width;
                const y = (orb.y + offsetY) * canvas.height;
                const radius = orb.radius * Math.min(canvas.width, canvas.height);

                const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
                gradient.addColorStop(0, `rgba(${orb.color.join(',')}, 0.4)`);
                gradient.addColorStop(0.5, `rgba(${orb.color.join(',')}, 0.1)`);
                gradient.addColorStop(1, 'transparent');

                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            });

            // Noise texture overlay
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const noise = (Math.random() - 0.5) * 15;
                data[i] += noise;
                data[i + 1] += noise;
                data[i + 2] += noise;
            }
            ctx.putImageData(imageData, 0, 0);

            animationId = requestAnimationFrame(animate);
        };

        resize();
        window.addEventListener('resize', resize);
        animate();

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className={`fixed inset-0 ${className}`}
            style={{ filter: 'blur(60px) saturate(150%)' }}
        />
    );
};

/**
 * Floating particles with depth
 */
const FloatingParticles = ({ count = 30 }) => {
    const particles = Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 20 + 20,
        delay: Math.random() * 5,
        opacity: Math.random() * 0.3 + 0.1,
    }));

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-10">
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    className="absolute rounded-full bg-white"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        width: p.size,
                        height: p.size,
                        opacity: p.opacity,
                    }}
                    animate={{
                        y: [0, -100, 0],
                        x: [0, Math.random() * 50 - 25, 0],
                        opacity: [p.opacity, p.opacity * 1.5, p.opacity],
                    }}
                    transition={{
                        duration: p.duration,
                        delay: p.delay,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
            ))}
        </div>
    );
};

/**
 * Sci-fi frosted glass panel
 */
const GlassPanel = ({ children, className = '' }) => (
    <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`relative ${className}`}
    >
        {/* Outer glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-xl" />

        {/* Glass container */}
        <div className="relative bg-white/5 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden">
            {/* Inner highlight */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />

            {/* Noise texture */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                }}
            />

            {/* Content */}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    </motion.div>
);

/**
 * Magnetic button with ripple
 */
const MagneticButton = ({ children, onClick, className = '', variant = 'primary' }) => {
    const buttonRef = useRef(null);
    const [ripples, setRipples] = React.useState([]);

    const handleMouseMove = (e) => {
        const btn = buttonRef.current;
        if (!btn) return;

        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
    };

    const handleMouseLeave = () => {
        const btn = buttonRef.current;
        if (btn) btn.style.transform = 'translate(0, 0)';
    };

    const handleClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const newRipple = { x, y, id: Date.now() };
        setRipples(prev => [...prev, newRipple]);
        setTimeout(() => setRipples(prev => prev.filter(r => r.id !== newRipple.id)), 800);

        onClick?.(e);
    };

    const variants = {
        primary: 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_100%] text-white shadow-lg shadow-indigo-500/30',
        ghost: 'bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10',
    };

    return (
        <motion.button
            ref={buttonRef}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            whileHover={{ scale: 1.02, backgroundPosition: '100% 0' }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className={`relative overflow-hidden px-8 py-4 rounded-xl font-semibold transition-all duration-300 ${variants[variant]} ${className}`}
        >
            {/* Ripples */}
            {ripples.map(ripple => (
                <motion.span
                    key={ripple.id}
                    initial={{ scale: 0, opacity: 0.5 }}
                    animate={{ scale: 3, opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute w-20 h-20 bg-white/30 rounded-full pointer-events-none"
                    style={{ left: ripple.x - 40, top: ripple.y - 40 }}
                />
            ))}
            <span className="relative z-10">{children}</span>
        </motion.button>
    );
};

/**
 * Glowing input field
 */
const GlowInput = ({ icon: Icon, ...props }) => (
    <div className="relative group">
        {/* Glow on focus */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl opacity-0 group-focus-within:opacity-50 blur transition-opacity duration-300" />

        <div className="relative flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden group-focus-within:border-white/20 transition-colors">
            {Icon && (
                <div className="pl-4 text-white/30 group-focus-within:text-indigo-400 transition-colors">
                    <Icon size={20} />
                </div>
            )}
            <input
                {...props}
                className="w-full bg-transparent px-4 py-4 text-white placeholder:text-white/30 focus:outline-none"
            />
        </div>
    </div>
);

export { MeshGradientBackground, FloatingParticles, GlassPanel, MagneticButton, GlowInput };
