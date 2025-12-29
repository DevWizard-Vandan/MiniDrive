import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import api from './api';
import { useAuth } from './context/AuthContext';

const Login = () => {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ username: '', password: '' });
    const navigate = useNavigate();
    const { login } = useAuth(); // Use Context to login

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/auth/login', form);
            // Use the context function instead of manual localStorage
            login(form.username, res.data.token);
            toast.success("Welcome back!");
            // Navigation handled by login() function in context usually,
            // but explicit navigate ensures redirection happens.
            navigate('/dashboard');
        } catch (err) {
            toast.error("Invalid credentials");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-sm">
            {/* Inputs */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
                <input
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all focus:bg-white"
                    value={form.username}
                    onChange={e => setForm({...form, username: e.target.value})}
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                <input
                    type="password"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all focus:bg-white"
                    value={form.password}
                    onChange={e => setForm({...form, password: e.target.value})}
                    required
                />
            </div>

            {/* Action Button */}
            <button
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 active:scale-95 transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {loading ? <Loader2 className="animate-spin" /> : "Sign In"}
            </button>

            {/* Footer Link */}
            <p className="mt-8 text-center text-slate-500 text-sm">
                Don't have an account? <Link to="/register" className="text-indigo-600 font-bold hover:underline">Sign up</Link>
            </p>
        </form>
    );
};

export default Login;