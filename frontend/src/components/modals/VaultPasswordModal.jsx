import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock, Eye, EyeOff, ShieldCheck, X } from 'lucide-react';
import { setVaultPassword, markVaultConfigured, storeVaultPasswordHash, verifyVaultPassword } from '../../utils/VaultCrypto';

/**
 * VaultPasswordModal - Password entry/creation modal for Vault access
 * 
 * Modes:
 * - 'create': First-time setup - requires password confirmation
 * - 'unlock': Returning user - single password entry
 */
const VaultPasswordModal = ({ isOpen, onClose, onUnlock, mode = 'unlock' }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setPassword('');
            setConfirmPassword('');
            setError('');
            setShowPassword(false);
        }
    }, [isOpen]);

    const validatePassword = () => {
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return false;
        }
        if (mode === 'create' && password !== confirmPassword) {
            setError('Passwords do not match');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!validatePassword()) return;

        setIsSubmitting(true);
        try {
            // In unlock mode, verify the password first
            if (mode === 'unlock') {
                const isValid = await verifyVaultPassword(password);
                if (!isValid) {
                    setError('Incorrect password');
                    setIsSubmitting(false);
                    return;
                }
            }

            // Store password in session storage
            setVaultPassword(password);

            // On first-time setup, store hash and mark as configured
            if (mode === 'create') {
                await storeVaultPasswordHash(password);
                markVaultConfigured();
            }

            onUnlock(password);
            onClose();
        } catch (err) {
            setError('Failed to set vault password');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getPasswordStrength = () => {
        if (password.length === 0) return { label: '', color: '', width: '0%' };
        if (password.length < 6) return { label: 'Weak', color: 'bg-red-500', width: '25%' };
        if (password.length < 10) return { label: 'Fair', color: 'bg-yellow-500', width: '50%' };
        if (password.length < 14) return { label: 'Good', color: 'bg-blue-500', width: '75%' };
        return { label: 'Strong', color: 'bg-green-500', width: '100%' };
    };

    const strength = getPasswordStrength();

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-md mx-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                >
                    {/* Header Glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-indigo-500/20 blur-3xl" />

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-white/40 hover:text-white/80 hover:bg-white/10 rounded-lg transition-all z-10"
                    >
                        <X size={20} />
                    </button>

                    {/* Content */}
                    <div className="relative p-8">
                        {/* Icon */}
                        <div className="flex justify-center mb-6">
                            <motion.div
                                animate={{
                                    boxShadow: [
                                        '0 0 20px rgba(99, 102, 241, 0.3)',
                                        '0 0 40px rgba(139, 92, 246, 0.4)',
                                        '0 0 20px rgba(99, 102, 241, 0.3)'
                                    ]
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"
                            >
                                {mode === 'create' ? (
                                    <ShieldCheck size={32} className="text-white" />
                                ) : (
                                    <Lock size={32} className="text-white" />
                                )}
                            </motion.div>
                        </div>

                        {/* Title */}
                        <h2 className="text-2xl font-bold text-white text-center mb-2">
                            {mode === 'create' ? 'Create Vault Password' : 'Unlock Vault'}
                        </h2>
                        <p className="text-white/50 text-center text-sm mb-6">
                            {mode === 'create'
                                ? 'Create a secure password to protect your vault files'
                                : 'Enter your vault password to access encrypted files'
                            }
                        </p>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Password Input */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/70">
                                    {mode === 'create' ? 'New Password' : 'Password'}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter password..."
                                        className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/80 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>

                                {/* Password Strength Indicator (only for create mode) */}
                                {mode === 'create' && password.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: strength.width }}
                                                className={`h-full ${strength.color} rounded-full`}
                                            />
                                        </div>
                                        <p className={`text-xs ${strength.color.replace('bg-', 'text-')}`}>
                                            {strength.label}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password (create mode only) */}
                            {mode === 'create' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/70">
                                        Confirm Password
                                    </label>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm password..."
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    />
                                </div>
                            )}

                            {/* Error Message */}
                            {error && (
                                <motion.p
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-red-400 text-sm text-center"
                                >
                                    {error}
                                </motion.p>
                            )}

                            {/* Warning */}
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                <p className="text-amber-400/90 text-xs text-center">
                                    ⚠️ Remember your password! Files cannot be recovered if forgotten.
                                </p>
                            </div>

                            {/* Submit Button */}
                            <motion.button
                                type="submit"
                                disabled={isSubmitting || password.length < 6}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isSubmitting ? (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                    />
                                ) : (
                                    <>
                                        <Unlock size={18} />
                                        {mode === 'create' ? 'Create & Unlock' : 'Unlock Vault'}
                                    </>
                                )}
                            </motion.button>
                        </form>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default VaultPasswordModal;
