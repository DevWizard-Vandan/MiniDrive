import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Lock, Mail, UserCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import toast from 'react-hot-toast';
import {
    MeshGradientBackground,
    FloatingParticles,
    GlassPanel,
    MagneticButton,
    GlowInput
} from './components/cinematic/CinematicUI';

const Register = () => {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        username: '',
        password: '',
        confirmPassword: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleChange = (field) => (e) => {
        setFormData(prev => ({ ...prev, [field]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.username || !formData.password) {
            toast.error('Please fill in required fields');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);
        try {
            await register(formData.username, formData.password);
            toast.success('Account created! Welcome aboard.');
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.message || 'Registration failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative overflow-hidden bg-[#0a0a0f]">
            {/* Cinematic Background */}
            <MeshGradientBackground />
            <FloatingParticles count={35} />

            {/* Vignette */}
            <div className="fixed inset-0 pointer-events-none z-20"
                style={{
                    background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)'
                }}
            />

            {/* Content */}
            <div className="relative z-30 min-h-screen flex items-center justify-center px-4 py-12">
                <GlassPanel className="w-full max-w-md">
                    <div className="p-8 md:p-10">
                        {/* Header */}
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-center mb-8"
                        >
                            <motion.div
                                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 mb-4 shadow-lg shadow-purple-500/30"
                                animate={{
                                    rotate: [0, 5, -5, 0],
                                    scale: [1, 1.05, 1],
                                }}
                                transition={{ duration: 4, repeat: Infinity }}
                            >
                                <Sparkles size={32} className="text-white" />
                            </motion.div>
                            <h1 className="text-3xl font-bold text-white mb-2">
                                Create Account
                            </h1>
                            <p className="text-white/40">
                                Start your cloud journey
                            </p>
                        </motion.div>

                        {/* Form */}
                        <motion.form
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            onSubmit={handleSubmit}
                            className="space-y-4"
                        >
                            <GlowInput
                                icon={UserCircle}
                                type="text"
                                placeholder="Full Name"
                                value={formData.fullName}
                                onChange={handleChange('fullName')}
                            />

                            <GlowInput
                                icon={Mail}
                                type="email"
                                placeholder="Email"
                                value={formData.email}
                                onChange={handleChange('email')}
                            />

                            <GlowInput
                                icon={User}
                                type="text"
                                placeholder="Username *"
                                value={formData.username}
                                onChange={handleChange('username')}
                            />

                            <GlowInput
                                icon={Lock}
                                type="password"
                                placeholder="Password *"
                                value={formData.password}
                                onChange={handleChange('password')}
                            />

                            <GlowInput
                                icon={Lock}
                                type="password"
                                placeholder="Confirm Password *"
                                value={formData.confirmPassword}
                                onChange={handleChange('confirmPassword')}
                            />

                            <MagneticButton
                                type="submit"
                                className="w-full mt-6"
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
                                        Get Started <ArrowRight size={18} />
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
                                Already have an account?{' '}
                                <Link
                                    to="/login"
                                    className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                                >
                                    Sign in
                                </Link>
                            </p>
                        </motion.div>
                    </div>
                </GlassPanel>
            </div>

            {/* Bottom accent */}
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-gradient-to-t from-purple-600/20 to-transparent blur-3xl pointer-events-none z-10" />
        </div>
    );
};

export default Register;