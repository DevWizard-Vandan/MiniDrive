import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import api from './api';

const Register = () => {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ username: '', password: '' });
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/auth/register', form);
            toast.success("Account created! Please login.");
            navigate('/login');
        } catch (err) {
            toast.error("Registration failed. Username might be taken.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-sm">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Choose Username</label>
                <input
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all focus:bg-white"
                    value={form.username}
                    onChange={e => setForm({...form, username: e.target.value})}
                    required
                    placeholder="e.g. cloudwalker"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Create Password</label>
                <input
                    type="password"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all focus:bg-white"
                    value={form.password}
                    onChange={e => setForm({...form, password: e.target.value})}
                    required
                    placeholder="••••••••"
                />
            </div>

            <button
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 active:scale-95 transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {loading ? <Loader2 className="animate-spin" /> : "Create Account"}
            </button>

            <p className="mt-8 text-center text-slate-500 text-sm">
                Already have an account? <Link to="/login" className="text-indigo-600 font-bold hover:underline">Sign in</Link>
            </p>
        </form>
    );
};

export default Register;