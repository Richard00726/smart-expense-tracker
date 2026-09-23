import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_BASE_URL = 'https://cash-upi-backend.onrender.com/api';
const API_URL_KEY = '@custom_api_url';

const api = axios.create({
  baseURL: DEFAULT_BASE_URL,
  timeout: 10000,
});

// Load saved custom server URL if present
export const initializeApiUrl = async () => {
  try {
    const savedUrl = await AsyncStorage.getItem(API_URL_KEY);
    if (savedUrl) {
      api.defaults.baseURL = savedUrl;
      return savedUrl;
    }
  } catch (e) {
    console.log("Error loading API URL:", e);
  }
  return DEFAULT_BASE_URL;
};

export const setCustomApiUrl = async (url) => {
  try {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }
    if (!cleanUrl.includes(':5000') && !cleanUrl.includes('/api')) {
      cleanUrl = `${cleanUrl}:5000/api`;
    } else if (!cleanUrl.endsWith('/api')) {
      cleanUrl = `${cleanUrl}/api`;
    }
    api.defaults.baseURL = cleanUrl;
    await AsyncStorage.setItem(API_URL_KEY, cleanUrl);
    return cleanUrl;
  } catch (e) {
    console.error("Error setting custom API URL:", e);
    return DEFAULT_BASE_URL;
  }
};

export const getApiUrl = () => api.defaults.baseURL;

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export const loginUser = (data) => api.post('/auth/login', data);
export const pushAutoTransaction = (data) => api.post('/transaction/auto', data);

export default api;
