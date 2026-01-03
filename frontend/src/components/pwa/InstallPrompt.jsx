import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone } from 'lucide-react';

/**
 * PWA Install Prompt Component
 * 
 * Shows a banner when the app can be installed as a PWA.
 * Uses the beforeinstallprompt event to trigger native install.
 */
const InstallPrompt = () => {
    const [installPrompt, setInstallPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState(false);

    useEffect(() => {
        // Listen for install prompt
        const handleBeforeInstall = (e) => {
            e.preventDefault();
            setInstallPrompt(e);

            // Don't show immediately - wait a bit
            setTimeout(() => {
                if (!localStorage.getItem('pwa-install-dismissed')) {
                    setShowBanner(true);
                }
            }, 30000); // Show after 30 seconds
        };

        // Listen for update available
        const handleUpdateAvailable = () => {
            setUpdateAvailable(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('sw-update-available', handleUpdateAvailable);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('sw-update-available', handleUpdateAvailable);
        };
    }, []);

    const handleInstall = async () => {
        if (!installPrompt) return;

        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('[PWA] User accepted install');
        }

        setInstallPrompt(null);
        setShowBanner(false);
    };

    const handleDismiss = () => {
        setShowBanner(false);
        localStorage.setItem('pwa-install-dismissed', 'true');
    };

    const handleUpdate = () => {
        window.location.reload();
    };

    return (
        <>
            {/* Install Banner */}
            <AnimatePresence>
                {showBanner && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
                    >
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-4 shadow-xl shadow-indigo-500/30">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-white/20 rounded-xl">
                                    <Smartphone size={24} className="text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-white font-semibold mb-1">Install SanchayCloud</h3>
                                    <p className="text-white/70 text-sm mb-3">
                                        Add to your home screen for a native app experience!
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleInstall}
                                            className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 font-medium rounded-lg hover:bg-white/90 transition-colors"
                                        >
                                            <Download size={16} />
                                            Install
                                        </button>
                                        <button
                                            onClick={handleDismiss}
                                            className="px-4 py-2 text-white/70 hover:text-white transition-colors"
                                        >
                                            Not now
                                        </button>
                                    </div>
                                </div>
                                <button
                                    onClick={handleDismiss}
                                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X size={18} className="text-white/50" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Update Available Banner */}
            <AnimatePresence>
                {updateAvailable && (
                    <motion.div
                        initial={{ y: -100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -100, opacity: 0 }}
                        className="fixed top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-96 z-50"
                    >
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-lg">
                            <div className="flex items-center justify-between">
                                <p className="text-white text-sm">
                                    A new version is available!
                                </p>
                                <button
                                    onClick={handleUpdate}
                                    className="px-3 py-1.5 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors"
                                >
                                    Update
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default InstallPrompt;
