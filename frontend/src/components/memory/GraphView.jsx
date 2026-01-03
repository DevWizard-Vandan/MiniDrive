import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, X, ZoomIn, ZoomOut, Maximize2, RefreshCw } from 'lucide-react';
import api from '../../api';

/**
 * 3D Graph View for Sanchay Memory
 * Shows semantic relationships between files
 * 
 * Note: Uses canvas-based rendering. For full 3D, install react-force-graph-3d
 * npm install react-force-graph-3d
 */
const GraphView = ({ onSelectFile }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
    const [isLoading, setIsLoading] = useState(false);
    const [selectedNode, setSelectedNode] = useState(null);
    const [threshold, setThreshold] = useState(0.3);
    const canvasRef = useRef(null);

    // Fetch graph data
    const fetchGraph = async () => {
        setIsLoading(true);
        try {
            const response = await api.get(`/memory/graph?threshold=${threshold}`);
            setGraphData(response.data);
        } catch (error) {
            console.error('Failed to fetch graph:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchGraph();
        }
    }, [isOpen, threshold]);

    // Assign colors by file type
    const getNodeColor = (type) => {
        const colors = {
            document: '#6366f1',
            text: '#8b5cf6',
            image: '#ec4899',
            video: '#ef4444',
            file: '#64748b'
        };
        return colors[type] || colors.file;
    };

    // Simple force-directed layout
    const layoutNodes = useMemo(() => {
        const nodes = graphData.nodes.map((node, i) => ({
            ...node,
            x: Math.random() * 600 + 100,
            y: Math.random() * 400 + 50,
            vx: 0,
            vy: 0
        }));

        // Run simple force simulation
        for (let iter = 0; iter < 100; iter++) {
            // Repulsion between nodes
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[j].x - nodes[i].x;
                    const dy = nodes[j].y - nodes[i].y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = 500 / (dist * dist);
                    nodes[i].vx -= (dx / dist) * force;
                    nodes[i].vy -= (dy / dist) * force;
                    nodes[j].vx += (dx / dist) * force;
                    nodes[j].vy += (dy / dist) * force;
                }
            }

            // Attraction for connected nodes
            graphData.edges.forEach(edge => {
                const source = nodes.find(n => n.id === edge.source);
                const target = nodes.find(n => n.id === edge.target);
                if (source && target) {
                    const dx = target.x - source.x;
                    const dy = target.y - source.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = dist * 0.01 * edge.weight;
                    source.vx += (dx / dist) * force;
                    source.vy += (dy / dist) * force;
                    target.vx -= (dx / dist) * force;
                    target.vy -= (dy / dist) * force;
                }
            });

            // Apply velocities with damping
            nodes.forEach(node => {
                node.x += node.vx * 0.1;
                node.y += node.vy * 0.1;
                node.vx *= 0.9;
                node.vy *= 0.9;
                // Keep in bounds
                node.x = Math.max(50, Math.min(750, node.x));
                node.y = Math.max(50, Math.min(450, node.y));
            });
        }

        return nodes;
    }, [graphData]);

    // Render graph on canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !isOpen) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw edges
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
        ctx.lineWidth = 1;
        graphData.edges.forEach(edge => {
            const source = layoutNodes.find(n => n.id === edge.source);
            const target = layoutNodes.find(n => n.id === edge.target);
            if (source && target) {
                ctx.beginPath();
                ctx.moveTo(source.x, source.y);
                ctx.lineTo(target.x, target.y);
                ctx.stroke();
            }
        });

        // Draw nodes
        layoutNodes.forEach(node => {
            // Glow
            ctx.beginPath();
            ctx.arc(node.x, node.y, 20, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 20);
            gradient.addColorStop(0, getNodeColor(node.type) + '60');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.fill();

            // Node
            ctx.beginPath();
            ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = selectedNode?.id === node.id
                ? '#ffffff'
                : getNodeColor(node.type);
            ctx.fill();

            // Label
            ctx.fillStyle = '#ffffff80';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            const shortName = node.name.length > 15
                ? node.name.substring(0, 12) + '...'
                : node.name;
            ctx.fillText(shortName, node.x, node.y + 25);
        });
    }, [layoutNodes, selectedNode, isOpen]);

    // Handle canvas click
    const handleCanvasClick = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const clicked = layoutNodes.find(node => {
            const dx = node.x - x;
            const dy = node.y - y;
            return Math.sqrt(dx * dx + dy * dy) < 15;
        });

        if (clicked) {
            setSelectedNode(clicked);
            onSelectFile?.(clicked.id);
        } else {
            setSelectedNode(null);
        }
    };

    return (
        <>
            {/* Toggle Button */}
            <motion.button
                onClick={() => setIsOpen(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all"
            >
                <Network size={18} />
                <span>Graph View</span>
            </motion.button>

            {/* Graph Modal */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="w-full max-w-5xl h-[80vh] flex flex-col rounded-2xl overflow-hidden"
                            style={{
                                background: 'rgba(15, 15, 25, 0.98)',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <Network className="text-indigo-400" size={20} />
                                    <h2 className="text-lg font-semibold text-white">Sanchay Memory Graph</h2>
                                    <span className="text-xs text-white/40">
                                        {graphData.nodes.length} files, {graphData.edges.length} connections
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 text-sm text-white/60">
                                        <span>Similarity:</span>
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="0.8"
                                            step="0.1"
                                            value={threshold}
                                            onChange={(e) => setThreshold(parseFloat(e.target.value))}
                                            className="w-24 accent-indigo-500"
                                        />
                                        <span className="w-8">{Math.round(threshold * 100)}%</span>
                                    </label>
                                    <button
                                        onClick={fetchGraph}
                                        className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                                    </button>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Canvas */}
                            <div className="flex-1 relative">
                                {graphData.nodes.length === 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center text-white/40">
                                        <div className="text-center">
                                            <Network size={48} className="mx-auto mb-4 opacity-30" />
                                            <p>No connected files found</p>
                                            <p className="text-sm">Upload documents to build your knowledge graph</p>
                                        </div>
                                    </div>
                                ) : (
                                    <canvas
                                        ref={canvasRef}
                                        width={800}
                                        height={500}
                                        onClick={handleCanvasClick}
                                        className="w-full h-full cursor-crosshair"
                                    />
                                )}
                            </div>

                            {/* Selected Node Info */}
                            {selectedNode && (
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="px-6 py-4 border-t border-white/10 bg-white/5"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-white font-medium">{selectedNode.name}</h3>
                                            <p className="text-sm text-white/50">
                                                Type: {selectedNode.type} • Click to preview
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => onSelectFile?.(selectedNode.id)}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
                                        >
                                            Open File
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default GraphView;
