import React from 'react';

const AnimatedBackground = () => {
    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none">
            {/* Gradient Orb 1 */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-indigo-400/30 rounded-full mix-blend-multiply filter blur-[80px] opacity-70 animate-blob" />

            {/* Gradient Orb 2 */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-400/30 rounded-full mix-blend-multiply filter blur-[80px] opacity-70 animate-blob animation-delay-2000" />

            {/* Gradient Orb 3 */}
            <div className="absolute -bottom-32 left-20 w-[600px] h-[600px] bg-pink-400/30 rounded-full mix-blend-multiply filter blur-[80px] opacity-70 animate-blob animation-delay-4000" />

            {/* Glass Overlay for depth */}
            <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px]" />
        </div>
    );
};

export default AnimatedBackground;