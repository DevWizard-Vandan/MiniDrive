import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    // Load from Storage on Boot
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) setUser(storedUser);
    }, []);

    const login = (username, token) => {
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
        <AuthContext.Provider value={{ user, login, logout, getAvatar }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);