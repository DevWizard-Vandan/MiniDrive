import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom'; // Remove BrowserRouter import
import { Toaster } from 'react-hot-toast';
import Dashboard from './Dashboard';
import Login from './Login';
import Register from './Register';
import AuthLayout from './AuthLayout';
import { AuthProvider, useAuth } from './context/AuthContext';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
    const { user } = useAuth();
    return user ? children : <Navigate to="/login" />;
};

function App() {
    return (
        // REMOVED <BrowserRouter> HERE
        <AuthProvider>
            <Toaster position="bottom-right" />
            <Routes>
                <Route path="/login" element={
                    <AuthLayout title="Welcome Back" subtitle="Access your secure cloud storage">
                        <Login />
                    </AuthLayout>
                } />
                <Route path="/register" element={
                    <AuthLayout title="Create Account" subtitle="Get 1TB free for your first file">
                        <Register />
                    </AuthLayout>
                } />
                <Route path="/dashboard" element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                } />
                <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
        </AuthProvider>
        // REMOVED </BrowserRouter> HERE
    );
}

export default App;