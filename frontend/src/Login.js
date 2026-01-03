import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Lock, ArrowRight, Zap } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import toast from 'react-hot-toast';
import {
    MeshGradientBackground,
    FloatingParticles,
    GlassPanel,
    MagneticButton,
    GlowInput
} from './components/cinematic/CinematicUI';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) {
            toast.error('Please fill in all fields');
            return;
        }

        setIsLoading(true);
        try {
            await login(username, password);
            toast.success('Welcome back!');
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.message || 'Invalid credentials');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative overflow-hidden bg-[#0a0a0f]">
            {/* Cinematic Background */}
            <MeshGradientBackground />
            <FloatingParticles count={40} />

            {/* Vignette overlay */}
            <div className="fixed inset-0 pointer-events-none z-20"
                style={{
                    background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)'
                }}
            />

            {/* Content */}
            <div className="relative z-30 min-h-screen flex items-center justify-center px-4 py-12">
                <GlassPanel className="w-full max-w-md">
                    <div className="p-8 md:p-10">
                        {/* Logo */}
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-center mb-10"
                        >
                            <motion.div
                                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 shadow-lg shadow-indigo-500/30"
                                animate={{
                                    boxShadow: [
                                        '0 10px 40px rgba(99, 102, 241, 0.3)',
                                        '0 10px 60px rgba(139, 92, 246, 0.4)',
                                        '0 10px 40px rgba(99, 102, 241, 0.3)',
                                    ]
                                }}
                                transition={{ duration: 3, repeat: Infinity }}
                            >
                                <Zap size={32} className="text-white" />
                            </motion.div>
                            <h1 className="text-3xl font-bold text-white mb-2">
                                Welcome Back
                            </h1>
                            <p className="text-white/40">
                                Sign in to your digital vault
                            </p>
                        </motion.div>

                        {/* Form */}
                        <motion.form
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            onSubmit={handleSubmit}
                            className="space-y-5"
                        >
                            <GlowInput
                                icon={User}
                                type="text"
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />

                            <GlowInput
                                icon={Lock}
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />

                            <MagneticButton
                                type="submit"
                                className="w-full"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                    />
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        Enter <ArrowRight size={18} />
                                    </span>
                                )}
                            </MagneticButton>
                        </motion.form>

                        {/* Footer */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className="mt-8 text-center"
                        >
                            <p className="text-white/30 text-sm">
                                New to SanchayCloud?{' '}
                                <Link
                                    to="/register"
                                    className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                                >
                                    Create account
                                </Link>
                            </p>
                        </motion.div>
                    </div>
                </GlassPanel>
            </div>

            {/* Bottom accent light */}
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-gradient-to-t from-indigo-600/20 to-transparent blur-3xl pointer-events-none z-10" />
        </div>
    );
};

export default Login;