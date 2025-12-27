import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Lock, User } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('http://localhost:8080/api/auth/login', { username, password });
            localStorage.setItem('token', res.data.token); // Save JWT
            localStorage.setItem('user', username);
            navigate('/'); // Go to Dashboard
        } catch (err) {
            setError('Invalid credentials');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-96 border border-slate-100">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg mx-auto mb-4">M</div>
                    <h2 className="text-2xl font-bold text-slate-800">Welcome Back</h2>
                    <p className="text-slate-400 text-sm">Sign in to MiniDrive</p>
                </div>

                {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 text-center">{error}</div>}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="relative">
                        <User className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                        <input
                            type="text" placeholder="Username" required
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            value={username} onChange={e => setUsername(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <Lock className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                        <input
                            type="password" placeholder="Password" required
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            value={password} onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:bg-indigo-700 transition-all active:scale-95">
                        Sign In
                    </button>
                </form>

                <p className="mt-6 text-center text-slate-500 text-sm">
                    New here? <Link to="/register" className="text-indigo-600 font-semibold hover:underline">Create an account</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;