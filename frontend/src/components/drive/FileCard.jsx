import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { File, FileImage, FileVideo, FileText, FileArchive, Folder, Star } from 'lucide-react';
import { formatBytes } from '../../utils/helpers';

const FileCard = ({ item, type, index = 0, onNavigate, onMove, isTrashView, onContextMenu }) => {
    const isFolder = type === 'folder';
    const cardRef = useRef(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);

    // File type config
    let Icon = File;
    let gradientFrom = '#64748b';
    let gradientTo = '#475569';

    if (isFolder) {
        Icon = Folder;
        gradientFrom = '#6366f1';
        gradientTo = '#8b5cf6';
    } else {
        const ext = item.name.split('.').pop().toLowerCase();
        if (['jpg', 'png', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
            Icon = FileImage;
            gradientFrom = '#8b5cf6';
            gradientTo = '#ec4899';
        }
        if (['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(ext)) {
            Icon = FileVideo;
            gradientFrom = '#ef4444';
            gradientTo = '#f97316';
        }
        if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) {
            Icon = FileText;
            gradientFrom = '#3b82f6';
            gradientTo = '#06b6d4';
        }
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
            Icon = FileArchive;
            gradientFrom = '#f59e0b';
            gradientTo = '#eab308';
        }
    }

    // 3D tilt + light source tracking
    const handleMouseMove = (e) => {
        const card = cardRef.current;
        if (!card) return;

        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        setMousePos({ x, y });
    };

    const handleDragStart = (e) => {
        e.dataTransfer.setData("itemId", item.id);
        e.dataTransfer.setData("itemType", type);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedId = e.dataTransfer.getData("itemId");
        const draggedType = e.dataTransfer.getData("itemType");
        if (isFolder && draggedId !== item.id.toString() && onMove) {
            onMove(draggedId, draggedType, item.id);
        }
    };

    // Calculate 3D transform
    const rotateX = isHovered ? (mousePos.y - 0.5) * -15 : 0;
    const rotateY = isHovered ? (mousePos.x - 0.5) * 15 : 0;

    // Light position for gradient effect
    const lightX = mousePos.x * 100;
    const lightY = mousePos.y * 100;

    return (
        <motion.div
            ref={cardRef}
            layout
            initial={{ opacity: 0, y: 30 }}
            animate={{
                opacity: 1,
                y: 0,
                rotateX,
                rotateY,
                z: isHovered ? 50 : 0,
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
                delay: index * 0.02,
                type: "spring",
                stiffness: 200,
                damping: 20
            }}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => { setIsHovered(false); setMousePos({ x: 0.5, y: 0.5 }); }}
            draggable={!isTrashView}
            onDragStart={handleDragStart}
            onDragOver={(e) => isFolder && e.preventDefault()}
            onDrop={handleDrop}
            onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, item, type); }}
            onDoubleClick={() => !isTrashView && onNavigate?.(item, type)}
            className="group relative cursor-pointer"
            style={{
                transformStyle: 'preserve-3d',
                perspective: 1000,
            }}
        >
            {/* Card container */}
            <div
                className="relative p-4 rounded-2xl overflow-hidden transition-shadow duration-300"
                style={{
                    background: `linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)`,
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: isHovered
                        ? `0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px ${gradientFrom}30`
                        : '0 4px 20px rgba(0,0,0,0.2)',
                }}
            >
                {/* Light source overlay */}
                <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                        background: `radial-gradient(circle at ${lightX}% ${lightY}%, rgba(255,255,255,0.15) 0%, transparent 60%)`,
                    }}
                />

                {/* Gradient border glow on hover */}
                <motion.div
                    className="absolute -inset-px rounded-2xl pointer-events-none"
                    animate={{ opacity: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                    style={{
                        background: `linear-gradient(135deg, ${gradientFrom}50, ${gradientTo}50)`,
                        filter: 'blur(1px)',
                    }}
                />

                {/* Icon Container */}
                <motion.div
                    animate={{
                        scale: isHovered ? 1.1 : 1,
                        y: isHovered ? -5 : 0,
                    }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="relative aspect-square rounded-xl flex items-center justify-center mb-3 overflow-hidden"
                    style={{
                        background: `linear-gradient(135deg, ${gradientFrom}20, ${gradientTo}20)`,
                        transformStyle: 'preserve-3d',
                        transform: `translateZ(${isHovered ? 30 : 0}px)`,
                    }}
                >
                    {/* Icon glow */}
                    <motion.div
                        className="absolute inset-0"
                        animate={{ opacity: isHovered ? 0.6 : 0 }}
                        style={{
                            background: `radial-gradient(circle, ${gradientFrom}40 0%, transparent 70%)`,
                        }}
                    />

                    <motion.div
                        animate={{ rotate: isHovered ? [0, -5, 5, 0] : 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <Icon
                            size={36}
                            style={{ color: gradientFrom }}
                            className="relative z-10 drop-shadow-lg"
                        />
                    </motion.div>
                </motion.div>

                {/* File info */}
                <div
                    className="relative space-y-1"
                    style={{ transform: `translateZ(${isHovered ? 20 : 0}px)` }}
                >
                    <div className="flex items-start gap-2">
                        <h3 className="flex-1 font-medium text-white/90 text-sm truncate" title={item.name}>
                            {item.name}
                        </h3>
                        {item.starred && !isTrashView && (
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                whileHover={{ scale: 1.2, rotate: 15 }}
                            >
                                <Star size={14} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                            </motion.div>
                        )}
                    </div>
                    <p className="text-xs text-white/40">
                        {isFolder ? "Folder" : formatBytes(item.size)}
                    </p>
                </div>
            </div>
        </motion.div>
    );
};

export default FileCard;