import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { initializeApiUrl, setCustomApiUrl, getApiUrl } from '../services/api';

export default function LoginScreen({ navigation }) {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [showServerConfig, setShowServerConfig] = useState(false);

  useEffect(() => {
    (async () => {
      const url = await initializeApiUrl();
      setServerUrl(url);
    })();
  }, []);

  const handleSaveServerUrl = async () => {
    if (serverUrl) {
      const updated = await setCustomApiUrl(serverUrl);
      setServerUrl(updated);
      setError('');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    // Ensure custom URL is saved before attempting login
    if (serverUrl) {
      await setCustomApiUrl(serverUrl);
    }

    const result = await login(email, password);
    
    setLoading(false);
    
    if (!result.success) {
      setError(result.error || 'Failed to connect. Check Server IP / Wi-Fi.');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.title}>Cash & UPI Tracker</Text>
          <Text style={styles.subtitle}>Securely access your account</Text>
          
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#64748b"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity 
            style={styles.button} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Server Config Toggle */}
          <TouchableOpacity 
            style={styles.configToggle} 
            onPress={() => setShowServerConfig(!showServerConfig)}
          >
            <Text style={styles.configToggleText}>
              ⚙️ {showServerConfig ? "Hide Server Settings" : "Server Connection Settings"}
            </Text>
          </TouchableOpacity>

          {showServerConfig && (
            <View style={styles.serverConfigBox}>
              <Text style={styles.configLabel}>Backend Server URL:</Text>
              <TextInput
                style={styles.serverInput}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://192.168.0.24:5000/api"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.saveUrlButton} onPress={handleSaveServerUrl}>
                <Text style={styles.saveUrlText}>Save Server URL</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.footerText}>
            Don't have an account? Sign up on the web dashboard.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 26,
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  errorText: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    padding: 10,
    borderRadius: 8,
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 13,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    color: '#fff',
    padding: 14,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  configToggle: {
    marginTop: 18,
    alignItems: 'center',
    padding: 6,
  },
  configToggleText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  serverConfigBox: {
    backgroundColor: '#0f172a',
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  configLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  serverInput: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    color: '#fff',
    padding: 10,
    fontSize: 13,
    marginBottom: 10,
  },
  saveUrlButton: {
    backgroundColor: '#475569',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveUrlText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footerText: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 13,
  }
});
