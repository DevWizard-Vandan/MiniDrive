import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Settings, User, LogOut, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Navbar = ({ onSearch, onOpenSettings, onOpenProfile }) => {
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleSearch = (value) => {
        setQuery(value);
        // Debounce search
        const timer = setTimeout(() => {
            onSearch?.(value);
        }, 300);
        return () => clearTimeout(timer);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-[#0c0c14]/80 backdrop-blur-xl">
            {/* Search */}
            <div className="flex-1 max-w-xl">
                <motion.div
                    className="relative"
                    animate={{
                        boxShadow: isFocused
                            ? '0 0 0 2px rgba(99, 102, 241, 0.3), 0 4px 20px rgba(99, 102, 241, 0.1)'
                            : 'none'
                    }}
                    style={{ borderRadius: 12 }}
                >
                    <Search size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isFocused ? 'text-indigo-400' : 'text-white/30'}`} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Search files..."
                        className="w-full pl-11 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                    {query && (
                        <motion.button
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            onClick={() => { setQuery(''); onSearch?.(''); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/60 transition-colors"
                        >
                            <X size={16} />
                        </motion.button>
                    )}
                </motion.div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-6">
                {/* Notifications */}
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative p-2.5 text-white/50 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                >
                    <Bell size={20} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full" />
                </motion.button>

                {/* Settings */}
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onOpenSettings}
                    className="p-2.5 text-white/50 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                >
                    <Settings size={20} />
                </motion.button>

                {/* Profile */}
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onOpenProfile}
                    className="p-2.5 text-white/50 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                >
                    <User size={20} />
                </motion.button>

                {/* Divider */}
                <div className="w-px h-8 bg-white/10 mx-2" />

                {/* Logout */}
                <motion.button
                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleLogout}
                    className="p-2.5 text-white/50 hover:text-red-400 rounded-xl transition-colors"
                >
                    <LogOut size={20} />
                </motion.button>
            </div>
        </nav>
    );
};

export default Navbar;