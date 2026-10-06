import React, { useContext } from 'react';
import { ActivityIndicator, View, StatusBar, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNAndroidNotificationListener, { RNAndroidNotificationListenerHeadlessJsName } from 'react-native-android-notification-listener';
import { AppRegistry } from 'react-native';

import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { parseNotification } from './src/utils/bankParsers';
import { pushAutoTransaction, setAuthToken } from './src/services/api';

import LoginScreen from './src/screens/LoginScreen';
import SetupScreen from './src/screens/SetupScreen';
import BankSelectionScreen from './src/screens/BankSelectionScreen';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, isLoading, loginWithToken } = useContext(AuthContext);

  React.useEffect(() => {
    const handleUrl = async (url) => {
      if (!url) return;
      try {
        console.log("Deep link received:", url);
        const match = url.match(/[?&]token=([^&]+)/);
        if (match && match[1]) {
          const receivedToken = decodeURIComponent(match[1]);
          await loginWithToken(receivedToken);
        }
      } catch (err) {
        console.error("Deep link error:", err);
      }
    };

    Linking.getInitialURL().then(url => {
      if (url) handleUrl(url);
    });

    const subscription = Linking.addEventListener('url', (event) => {
      if (event?.url) handleUrl(event.url);
    });

    return () => subscription.remove();
  }, [loginWithToken]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <Stack.Navigator 
        screenOptions={{
          headerStyle: { backgroundColor: '#1e293b' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        {user ? (
          <>
            <Stack.Screen 
              name="Setup" 
              component={SetupScreen} 
              options={{ title: 'Tracker Setup' }} 
            />
            <Stack.Screen 
              name="BankSelection" 
              component={BankSelectionScreen} 
              options={{ title: 'Linked Banks' }} 
            />
          </>
        ) : (
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ headerShown: false }} 
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
