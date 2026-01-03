import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Sparkles, FileText, Loader2 } from 'lucide-react';
import api from '../../api';

/**
 * Chat with Drive - Floating RAG chat interface
 */
const ChatWithDrive = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await api.post('/memory/chat', { query: input });

            const assistantMessage = {
                role: 'assistant',
                content: response.data.answer,
                sources: response.data.sources
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                error: true
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Floating Button */}
            <motion.button
                onClick={() => setIsOpen(true)}
                initial={{ scale: 0 }}
                animate={{ scale: isOpen ? 0 : 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center"
            >
                <MessageCircle size={24} />
                <motion.div
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                />
            </motion.button>

            {/* Chat Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25 }}
                        className="fixed bottom-6 right-6 z-50 w-96 h-[32rem] flex flex-col rounded-2xl overflow-hidden"
                        style={{
                            background: 'rgba(15, 15, 25, 0.95)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <Sparkles size={18} className="text-indigo-400" />
                                <span className="font-semibold text-white">Chat with Drive</span>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 text-white/50 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.length === 0 && (
                                <div className="text-center text-white/40 mt-8">
                                    <Sparkles className="mx-auto mb-3 text-indigo-400" size={32} />
                                    <p className="text-sm">Ask me anything about your files!</p>
                                    <p className="text-xs mt-2 text-white/30">
                                        "Where are my travel documents?"<br />
                                        "Summarize my project specs"
                                    </p>
                                </div>
                            )}

                            {messages.map((msg, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm ${msg.role === 'user'
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                                            : 'bg-white/5 text-white/90 border border-white/10'
                                        }`}>
                                        {msg.content}

                                        {/* Sources */}
                                        {msg.sources && msg.sources.length > 0 && (
                                            <div className="mt-3 pt-2 border-t border-white/10 space-y-1">
                                                <p className="text-xs text-white/50">Sources:</p>
                                                {msg.sources.map((src, j) => (
                                                    <div key={j} className="flex items-center gap-2 text-xs text-indigo-400">
                                                        <FileText size={12} />
                                                        <span className="truncate">{src.filename}</span>
                                                        <span className="text-white/30">{src.similarity}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}

                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
                                        <Loader2 className="animate-spin text-indigo-400" size={20} />
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-white/10">
                            <div className="flex gap-2">
                                <input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Ask about your files..."
                                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50"
                                />
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleSend}
                                    disabled={isLoading}
                                    className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl text-white disabled:opacity-50"
                                >
                                    <Send size={18} />
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default ChatWithDrive;
