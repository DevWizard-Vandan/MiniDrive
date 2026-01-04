import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    // Load from Storage on Boot
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) setUser(storedUser);
    }, []);

    const login = async (username, password) => {
        const response = await api.post('/auth/login', { username, password });
        const { token } = response.data;

        localStorage.setItem('token', token);
        localStorage.setItem('user', username);
        setUser(username);
        navigate('/dashboard');
    };

    const register = async (username, password) => {
        const response = await api.post('/auth/register', { username, password });
        const { token } = response.data;

        localStorage.setItem('token', token);
        localStorage.setItem('user', username);
        setUser(username);
        navigate('/dashboard');
    };

    const logout = () => {
        if (window.confirm("Sign out of SanchayCloud?")) {
            localStorage.clear();
            setUser(null);
            navigate('/login');
            toast.success("Signed out");
        }
    };

    // Avatar Logic (Initials)
    const getAvatar = () => user ? user.charAt(0).toUpperCase() : 'U';

    return (
        <AuthContext.Provider value={{ user, login, register, logout, getAvatar }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);