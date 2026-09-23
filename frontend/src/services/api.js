import axios from 'axios';

// Since the backend is running on 5000 and frontend usually on 5173
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

// Add a request interceptor to inject the token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token is invalid or expired
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Dispatch a custom event so App.jsx can listen and update state
      window.dispatchEvent(new Event('auth_error'));
    }
    return Promise.reject(error);
  }
);

// Auth Services
export const sendOTP = (data) => api.post('/auth/send-otp', data);
export const registerUser = (data) => api.post('/auth/register', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const getUser = () => api.get('/auth/me');
export const forgotPassword = (data) => api.post('/auth/forgot-password', data);
export const resetPassword = (data) => api.post('/auth/reset-password', data);
export const updateProfile = (data) => api.put('/auth/profile', data);
export const changePassword = (data) => api.put('/auth/change-password', data);
export const deleteAccount = () => api.delete('/auth/account');

// Wallet and Transaction Services
export const getWallets = () => api.get('/wallets');
export const getTransactions = (filters) => api.get('/transactions', { params: filters });
export const getSummary = (filters) => api.get('/summary', { params: filters });
export const createTransaction = (data) => api.post('/transaction', data);
export const deleteTransaction = (id) => api.delete(`/transaction/${id}`);
export const updateTransaction = (id, data) => api.put(`/transaction/${id}`, data);

export const getCurrency = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    return user?.currency || '₹';
  } catch {
    return '₹';
  }
};

export default api;
