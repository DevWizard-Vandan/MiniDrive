import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import Dashboard from './Dashboard';
import Login from './Login';
import Register from './Register';
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
                            style: {
                                background: 'rgba(15, 15, 25, 0.95)',
                                color: '#fff',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255,255,255,0.1)',
                            },
                            duration: 3000,
                        }}
                    />
                    <AnimatePresence mode="wait">
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
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