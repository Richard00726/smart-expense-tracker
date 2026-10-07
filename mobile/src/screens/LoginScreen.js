import React, { useState, useEffect, useContext } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  Modal,
  SafeAreaView
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { AuthContext } from '../context/AuthContext';
import { initializeApiUrl, setCustomApiUrl, getApiUrl } from '../services/api';

export default function LoginScreen({ navigation }) {
  const { login, loginWithToken } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [showServerConfig, setShowServerConfig] = useState(false);

  // In-app QR Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [isScanningLogin, setIsScanningLogin] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

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

    if (serverUrl) {
      await setCustomApiUrl(serverUrl);
    }

    const result = await login(email, password);
    setLoading(false);
    
    if (!result.success) {
      setError(result.error || 'Failed to connect. Check Server IP / Wi-Fi.');
    }
  };

  const handleOpenScanner = async () => {
    setError('');
    setScanned(false);
    setIsScanningLogin(false);
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setError('Camera permission is required to scan QR code');
        return;
      }
    }
    setShowScanner(true);
  };

  const handleBarcodeScanned = async ({ data }) => {
    if (scanned || isScanningLogin) return;
    setScanned(true);
    setIsScanningLogin(true);

    try {
      let token = data;
      // If URL contains token parameter (e.g. ?token=... or &token=...)
      const match = data.match(/[?&]token=([^&]+)/);
      if (match && match[1]) {
        token = decodeURIComponent(match[1]);
      } else {
        // Try parsing JSON if encoded as object
        try {
          const parsed = JSON.parse(data);
          if (parsed.token) token = parsed.token;
        } catch (e) {}
      }

      const res = await loginWithToken(token);
      if (!res.success) {
        setError(res.error || 'Failed to authenticate QR Code');
        setIsScanningLogin(false);
        setScanned(false);
      } else {
        setShowScanner(false);
      }
    } catch (err) {
      console.error('Barcode scanning error:', err);
      setError('Invalid QR code format');
      setIsScanningLogin(false);
      setScanned(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.title}>Smart Expense Tracker</Text>
          <Text style={styles.subtitle}>Securely access your account</Text>
          
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Quick Scan QR Code Button */}
          <TouchableOpacity 
            style={styles.qrScanButton} 
            onPress={handleOpenScanner}
            activeOpacity={0.8}
          >
            <View style={styles.qrIconBadge}>
              <Text style={styles.qrScanIcon}>📷</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.qrScanButtonTitle}>Scan QR Code to Log In</Text>
              <Text style={styles.qrScanButtonSub}>Scan code from your web dashboard</Text>
            </View>
            <Text style={styles.qrScanChevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR SIGN IN MANUALLY</Text>
            <View style={styles.dividerLine} />
          </View>

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

      {/* In-App Camera Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <SafeAreaView style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scan QR Code</Text>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setShowScanner(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {!permission ? (
            <View style={styles.permissionBox}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.permissionText}>Initializing camera...</Text>
            </View>
          ) : !permission.granted ? (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionTitle}>Camera Access Required</Text>
              <Text style={styles.permissionDesc}>
                Camera permission is needed to scan your web dashboard login QR code.
              </Text>
              <TouchableOpacity style={styles.grantButton} onPress={requestPermission}>
                <Text style={styles.grantButtonText}>Grant Permission</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelScanButton} onPress={() => setShowScanner(false)}>
                <Text style={styles.cancelScanText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cameraWrapper}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              />

              {/* Viewfinder Overlay */}
              <View style={styles.overlay}>
                <View style={styles.unfocusedTop} />
                
                <View style={styles.middleRow}>
                  <View style={styles.unfocusedSide} />
                  
                  <View style={styles.focusedBox}>
                    {/* Corner Reticles */}
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />

                    {isScanningLogin && (
                      <View style={styles.scanningStatusBox}>
                        <ActivityIndicator size="large" color="#10b981" />
                        <Text style={styles.scanningStatusText}>Authenticating...</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.unfocusedSide} />
                </View>

                <View style={styles.unfocusedBottom}>
                  <Text style={styles.hintText}>
                    Align the QR code from your web dashboard within the frame
                  </Text>
                  {scanned && !isScanningLogin && (
                    <TouchableOpacity 
                      style={styles.rescanBtn} 
                      onPress={() => setScanned(false)}
                    >
                      <Text style={styles.rescanBtnText}>Tap to Scan Again</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>
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
    padding: 24,
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
    marginTop: 6,
    marginBottom: 20,
  },
  errorText: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    color: '#ef4444',
    padding: 12,
    borderRadius: 10,
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  qrScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    gap: 12,
  },
  qrIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrScanIcon: {
    fontSize: 22,
  },
  qrScanButtonTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  qrScanButtonSub: {
    color: '#93c5fd',
    fontSize: 12,
    marginTop: 2,
  },
  qrScanChevron: {
    color: '#60a5fa',
    fontSize: 24,
    fontWeight: '300',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    color: '#fff',
    padding: 13,
    fontSize: 15,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  configToggle: {
    marginTop: 16,
    alignItems: 'center',
    padding: 6,
  },
  configToggleText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  serverConfigBox: {
    backgroundColor: '#0f172a',
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
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
    marginTop: 18,
    fontSize: 12,
  },

  /* Scanner Styles */
  scannerContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  scannerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  unfocusedTop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  middleRow: {
    flexDirection: 'row',
    height: 260,
  },
  unfocusedSide: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  focusedBox: {
    width: 260,
    height: 260,
    position: 'relative',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unfocusedBottom: {
    flex: 1.2,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  hintText: {
    color: '#e2e8f0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  rescanBtn: {
    marginTop: 16,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  rescanBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#10b981',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  scanningStatusBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  scanningStatusText: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 14,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionDesc: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  grantButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  grantButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  cancelScanButton: {
    padding: 10,
  },
  cancelScanText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  permissionText: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 12,
  },
});
