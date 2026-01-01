import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Bell, Settings, LogOut, User, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

const Navbar = ({ onSearch, onOpenSettings, onOpenProfile }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const { theme, toggleTheme, isDark } = useTheme();

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            onSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, onSearch]);

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div className="h-14 px-6 flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-20 transition-colors duration-300">

            {/* Search Bar */}
            <div className="flex-1 max-w-xl">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Search files and folders..."
                        value={searchQuery}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 focus:border-indigo-300 dark:focus:border-indigo-700 focus:bg-white dark:focus:bg-slate-800 transition-all outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-1 ml-6">
                {/* Theme Toggle */}
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleTheme}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                    title={isDark ? "Light Mode" : "Dark Mode"}
                >
                    <motion.div
                        initial={false}
                        animate={{ rotate: isDark ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {isDark ? <Sun size={18} /> : <Moon size={18} />}
                    </motion.div>
                </motion.button>

                <button
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all relative"
                    title="Notifications"
                >
                    <Bell size={18} />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                </button>
                <button
                    onClick={onOpenSettings}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                    title="Settings"
                >
                    <Settings size={18} />
                </button>
                <button
                    onClick={handleLogout}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                    title="Logout"
                >
                    <LogOut size={18} />
                </button>

                {/* Profile Avatar */}
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onOpenProfile}
                    className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-indigo-500/30 cursor-pointer select-none ml-2"
                    title="Profile"
                >
                    V
                </motion.button>
            </div>
        </div>
    );
};

export default Navbar;