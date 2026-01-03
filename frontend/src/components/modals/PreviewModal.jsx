import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

/**
 * Cinematic Preview Modal with custom video player controls
 */
const PreviewModal = ({ file, onClose, onDownload }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [progress, setProgress] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const videoRef = useRef(null);
    const controlsTimer = useRef(null);

    if (!file) return null;

    const token = localStorage.getItem('token');
    const fileUrl = `http://localhost:8080/api/drive/view/${file.name}?token=${token}`;
    const ext = file.name.split('.').pop().toLowerCase();

    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
    const isVideo = ['mp4', 'webm', 'mov'].includes(ext);
    const isPDF = ext === 'pdf';

    // Auto-hide controls for video
    const resetControlsTimer = () => {
        setShowControls(true);
        clearTimeout(controlsTimer.current);
        if (isPlaying) {
            controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
        }
    };

    useEffect(() => {
        return () => clearTimeout(controlsTimer.current);
    }, []);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const percent = (videoRef.current.currentTime / videoRef.current.duration) * 100;
            setProgress(percent);
        }
    };

    const handleSeek = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        if (videoRef.current) {
            videoRef.current.currentTime = percent * videoRef.current.duration;
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black flex flex-col"
                onMouseMove={resetControlsTimer}
            >
                {/* Background blur from content */}
                {isImage && (
                    <div
                        className="absolute inset-0 opacity-30 blur-3xl scale-110"
                        style={{
                            backgroundImage: `url(${fileUrl})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }}
                    />
                )}

                {/* Header - fades with controls */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : -20 }}
                    transition={{ duration: 0.3 }}
                    className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent"
                >
                    <h3 className="text-white font-medium truncate max-w-lg">{file.name}</h3>
                    <div className="flex items-center gap-3">
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onDownload(file)}
                            className="p-2 text-white/60 hover:text-white rounded-full hover:bg-white/10 transition-all"
                        >
                            <Download size={20} />
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onClose}
                            className="p-2 text-white/60 hover:text-white rounded-full hover:bg-white/10 transition-all"
                        >
                            <X size={24} />
                        </motion.button>
                    </div>
                </motion.div>

                {/* Content */}
                <div className="flex-1 flex items-center justify-center p-4 relative">
                    {/* Image */}
                    {isImage && (
                        <motion.img
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', damping: 20 }}
                            src={fileUrl}
                            alt={file.name}
                            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
                        />
                    )}

                    {/* Video with custom controls */}
                    {isVideo && (
                        <div className="relative max-w-6xl w-full">
                            <video
                                ref={videoRef}
                                src={fileUrl}
                                className="w-full rounded-xl shadow-2xl"
                                onTimeUpdate={handleTimeUpdate}
                                onEnded={() => setIsPlaying(false)}
                                onClick={togglePlay}
                            />

                            {/* Custom Controls */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: showControls ? 1 : 0 }}
                                className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent rounded-b-xl"
                            >
                                {/* Progress bar */}
                                <div
                                    className="w-full h-1 bg-white/20 rounded-full mb-4 cursor-pointer group"
                                    onClick={handleSeek}
                                >
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full relative"
                                        style={{ width: `${progress}%` }}
                                    >
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
                                    </motion.div>
                                </div>

                                {/* Control buttons */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={togglePlay}
                                            className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                                        >
                                            {isPlaying ? <Pause size={20} className="text-white" /> : <Play size={20} className="text-white ml-0.5" />}
                                        </motion.button>

                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setIsMuted(!isMuted)}
                                            className="p-2 text-white/60 hover:text-white transition-colors"
                                        >
                                            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                        </motion.button>
                                    </div>

                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={toggleFullscreen}
                                        className="p-2 text-white/60 hover:text-white transition-colors"
                                    >
                                        {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                                    </motion.button>
                                </div>
                            </motion.div>

                            {/* Center play button overlay */}
                            <AnimatePresence>
                                {!isPlaying && (
                                    <motion.button
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        onClick={togglePlay}
                                        className="absolute inset-0 flex items-center justify-center"
                                    >
                                        <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
                                            <Play size={36} className="text-white ml-1" />
                                        </div>
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* PDF */}
                    {isPDF && (
                        <iframe
                            src={fileUrl}
                            className="w-full max-w-5xl h-[85vh] bg-white rounded-xl shadow-2xl"
                            title="PDF Preview"
                        />
                    )}

                    {/* Unsupported */}
                    {!isImage && !isVideo && !isPDF && (
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-center p-8 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10"
                        >
                            <p className="text-xl text-white/80 mb-4">Preview not available</p>
                            <p className="text-white/40 mb-6">This file type cannot be previewed</p>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => onDownload(file)}
                                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl text-white font-semibold"
                            >
                                Download File
                            </motion.button>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default PreviewModal;