import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthToken } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from storage on boot
  useEffect(() => {
    const loadStorageData = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        const storedUser = await AsyncStorage.getItem('user');

        if (storedToken) {
          setToken(storedToken);
          setAuthToken(storedToken);
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
        }
      } catch (e) {
        console.error('Failed to load auth data', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadStorageData();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token: newToken, ...userData } = response.data;
      
      setToken(newToken);
      setUser(userData);
      setAuthToken(newToken);

      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    }
  };

  const loginWithToken = async (newToken) => {
    try {
      setAuthToken(newToken);
      const response = await api.get('/auth/me');
      const userData = response.data;
      
      setToken(newToken);
      setUser(userData);

      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      return { success: true, user: userData };
    } catch (error) {
      console.error('Failed to log in with token:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Invalid or expired login token' 
      };
    }
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
  };

  const updateLinkedBanks = async (banks) => {
    try {
      await AsyncStorage.setItem('linkedBanks', JSON.stringify(banks));
      setUser(prev => ({ ...prev, linkedBanks: banks }));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, loginWithToken, logout, updateLinkedBanks }}>
      {children}
    </AuthContext.Provider>
  );
};
