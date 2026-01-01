import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import Dashboard from './Dashboard';
import Login from './Login';
import Register from './Register';
import AuthLayout from './AuthLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
    const { user } = useAuth();
    return user ? children : <Navigate to="/login" />;
};

function App() {
    return (
        <ErrorBoundary>
            <ThemeProvider>
                <AuthProvider>
                    <Toaster
                        position="bottom-right"
                        toastOptions={{
                            className: 'dark:bg-slate-800 dark:text-white',
                            duration: 3000,
                        }}
                    />
                    <AnimatePresence mode="wait">
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
                    </AnimatePresence>
                </AuthProvider>
            </ThemeProvider>
        </ErrorBoundary>
    );
}

export default App;