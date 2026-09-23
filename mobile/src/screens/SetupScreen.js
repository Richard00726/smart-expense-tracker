import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, AppState } from 'react-native';
import RNAndroidNotificationListener from 'react-native-android-notification-listener';
import { AuthContext } from '../context/AuthContext';

export default function SetupScreen({ navigation }) {
  const { logout } = useContext(AuthContext);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    checkPermission();
    
    // Re-check permission when app comes back to foreground
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        checkPermission();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const checkPermission = async () => {
    try {
      if (!RNAndroidNotificationListener) {
        setHasPermission(false);
        return;
      }
      const status = await RNAndroidNotificationListener.getPermissionStatus();
      setHasPermission(status !== 'denied');
    } catch (e) {
      console.log('Error checking permissions:', e);
      setHasPermission(false);
    }
  };

  const requestPermission = () => {
    if (!RNAndroidNotificationListener) {
      Alert.alert(
        "Expo Go Limitation", 
        "The Notification Listener requires custom Android native code. It cannot run inside the standard Expo Go app. You must build a custom Development Build (APK) to use this feature!"
      );
      return;
    }
    RNAndroidNotificationListener.requestPermission();
  };

  const proceedToBanks = () => {
    if (!hasPermission) {
      Alert.alert(
        "Permission Required", 
        "You must grant Notification Access so the app can detect bank alerts."
      );
      return;
    }
    navigation.navigate('BankSelection');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Connect Notifications</Text>
        
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            Connect your bank/UPI notifications to automatically track transactions. 
            {"\n\n"}
            This app does <Text style={{fontWeight: 'bold', color: '#fff'}}>NOT</Text> connect to your bank account or UPI app directly. 
            It only reads the notification text (SMS or App alerts) that already appears on your phone, purely to extract the spent amounts.
          </Text>
        </View>

        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Auto-Tracking Status:</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.dot, { backgroundColor: hasPermission ? '#10b981' : '#ef4444' }]} />
            <Text style={[styles.statusText, { color: hasPermission ? '#10b981' : '#ef4444' }]}>
              {hasPermission ? "Connected" : "Disconnected"}
            </Text>
          </View>
        </View>

        {!hasPermission ? (
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Enable Auto-Tracking</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.successButton} onPress={proceedToBanks}>
            <Text style={styles.primaryButtonText}>Select Banks to Track ➔</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0f172a',
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    marginBottom: 24,
  },
  infoTitle: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  infoText: {
    color: '#cbd5e1',
    lineHeight: 22,
    fontSize: 14,
  },
  statusBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusLabel: {
    color: '#94a3b8',
    fontSize: 15,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  successButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logoutButton: {
    marginTop: 20,
    padding: 10,
    alignItems: 'center',
  },
  logoutText: {
    color: '#94a3b8',
    fontSize: 14,
  }
});
