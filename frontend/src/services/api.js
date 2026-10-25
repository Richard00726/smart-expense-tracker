import axios from 'axios';

// Detect if running inside native Android / Capacitor APK or browser
export const isNative = typeof window !== 'undefined' && (
  window.Capacitor?.isNativePlatform?.() || 
  window.location.protocol === 'capacitor:' || 
  window.location.hostname === 'localhost' && window.location.port === ''
);

export const API_URL = isNative
  ? 'https://cash-upi-backend.onrender.com/api'
  : (import.meta.env.VITE_API_URL || 'http://localhost:5000/api');

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
export const updateSyncSettings = (data) => api.put('/auth/sync-settings', data);
export const getSyncStatus = () => api.get('/auth/sync-status');
export const changePassword = (data) => api.put('/auth/change-password', data);
export const deleteAccount = () => api.delete('/auth/account');

// Wallet and Transaction Services
export const getWallets = () => api.get('/wallets');
export const getTransactions = (filters) => api.get('/transactions', { params: filters });
export const getSummary = (filters) => api.get('/summary', { params: filters });
export const createTransaction = (data) => api.post('/transaction', data);
export const deleteTransaction = (id) => api.delete(`/transaction/${id}`);
export const updateTransaction = (id, data) => api.put(`/transaction/${id}`, data);

// Bank & Gmail Sync Services
export const getBankSyncSettings = () => api.get('/bank-sync/settings');
export const getBankOverview = () => api.get('/bank-sync/overview');
export const updateBankSyncSettings = (data) => api.put('/bank-sync/settings', data);
export const uploadStatementPdf = (formData) => api.post('/bank-sync/upload-statement', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const getGoogleAuthUrl = (data) => api.post('/bank-sync/google-auth-url', data);
export const connectGoogleAccount = (data) => api.post('/bank-sync/google-connect', data);
export const syncGmailNow = (options = {}) => api.post('/bank-sync/sync-gmail-now', options);
export const disconnectGmail = () => api.post('/bank-sync/disconnect');
export const deleteBankSyncConfig = (data = {}) => api.delete('/bank-sync/configuration', { data });

export const getCurrency = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    return user?.currency || '₹';
  } catch {
    return '₹';
  }
};

export default api;
