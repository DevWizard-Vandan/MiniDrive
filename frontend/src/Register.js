import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './api'; // Use our new robust API
import AuthLayout from './AuthLayout';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

const Register = () => {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ username: '', password: '' });
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Correct API call for registration
            const res = await api.post('/auth/register', form);

            // Auto-login after registration
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', form.username);

            toast.success("Account created successfully! 🚀");
            navigate('/');
        } catch (err) {
            // Error handled by api.js interceptor
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="Create Account" subtitle="Join MiniDrive to store and share files.">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                    <input
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                        value={form.username}
                        onChange={e => setForm({...form, username: e.target.value})}
                        required
                        placeholder="Choose a username"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <input
                        type="password"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                        value={form.password}
                        onChange={e => setForm({...form, password: e.target.value})}
                        required
                        placeholder="Choose a password"
                    />
                </div>
                <button
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center"
                >
                    {loading ? <Loader2 className="animate-spin" /> : "Sign Up"}
                </button>
            </form>
            <p className="mt-8 text-center text-slate-500">
                Already have an account? <Link to="/login" className="text-indigo-600 font-semibold hover:underline">Log in</Link>
            </p>
        </AuthLayout>
    );
};

export default Register;