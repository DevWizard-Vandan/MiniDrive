import React, { useEffect, useRef, useCallback } from 'react';

/**
 * Interactive particle background with mouse-reactive floating particles.
 * Creates an ambient, dynamic atmosphere.
 */
const ParticleBackground = ({
    particleCount = 50,
    color = 'rgba(99, 102, 241, 0.3)',
    speed = 0.5,
    interactive = true
}) => {
    const canvasRef = useRef(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const particlesRef = useRef([]);

    const initParticles = useCallback((width, height) => {
        const particles = [];
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 3 + 1,
                speedX: (Math.random() - 0.5) * speed,
                speedY: (Math.random() - 0.5) * speed,
                opacity: Math.random() * 0.5 + 0.2,
            });
        }
        return particles;
    }, [particleCount, speed]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let animationId;
        let particles = [];

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            particles = initParticles(canvas.width, canvas.height);
            particlesRef.current = particles;
        };

        const handleMouseMove = (e) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach((p, i) => {
                // Mouse interaction
                if (interactive) {
                    const dx = mouseRef.current.x - p.x;
                    const dy = mouseRef.current.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 150) {
                        const force = (150 - dist) / 150;
                        p.x -= dx * force * 0.02;
                        p.y -= dy * force * 0.02;
                    }
                }

                // Movement
                p.x += p.speedX;
                p.y += p.speedY;

                // Wrap around
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;

                // Draw particle
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = color.replace(')', `, ${p.opacity})`).replace('rgba', 'rgba');
                ctx.fill();

                // Draw connections
                particles.slice(i + 1).forEach((p2) => {
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 100) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = color.replace('0.3', `${0.1 * (1 - dist / 100)}`);
                        ctx.stroke();
                    }
                });
            });

            animationId = requestAnimationFrame(animate);
        };

        resize();
        window.addEventListener('resize', resize);
        if (interactive) {
            window.addEventListener('mousemove', handleMouseMove);
        }
        animate();

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [color, interactive, initParticles]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-0"
            style={{ opacity: 0.6 }}
        />
    );
};

export default ParticleBackground;
