import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
    baseURL: 'http://localhost:8080/api',
});

// Request Interceptor: Auto-attach token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response Interceptor: Global Error Handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const msg = error.response?.data?.message || "Something went wrong";

        if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.clear();
            window.location.href = '/login'; // Force redirect
        } else {
            toast.error(msg); // Show nice notification
        }
        return Promise.reject(error);
    }
);

export default api;