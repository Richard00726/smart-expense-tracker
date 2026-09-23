import { registerRootComponent } from 'expo';
import { AppRegistry } from 'react-native';
import { RNAndroidNotificationListenerHeadlessJsName } from 'react-native-android-notification-listener';

import App from './App';
import { parseNotification } from './src/utils/bankParsers';
import { queueTransaction, syncPendingTransactions } from './src/services/syncQueue';

// Background headless task for handling notifications when app is closed or in background
const headlessNotificationListener = async ({ notification }) => {
  if (notification) {
    try {
      const parsed = typeof notification === 'string' ? JSON.parse(notification) : notification;
      console.log("📥 [Notification Intercepted]:", {
        app: parsed.app,
        title: parsed.title,
        text: parsed.text,
        subText: parsed.subText,
        bigText: parsed.bigText
      });

      const transactionData = parseNotification(parsed.app, parsed.title, parsed.text || parsed.bigText);

      if (transactionData) {
        console.log("✅ [Parsed Transaction]:", transactionData);
        // 1. Always queue locally first (offline guarantee)
        await queueTransaction(transactionData);
        
        // 2. Attempt to flush/sync queue to server
        const result = await syncPendingTransactions();
        if (result.synced > 0) {
          console.log(`🚀 [Backend Synced Successfully]: ${result.synced} transaction(s) synced.`);
        } else if (result.remaining > 0) {
          console.log(`📦 [Offline Mode]: ${result.remaining} transaction(s) saved locally in queue for later sync.`);
        }
      } else {
        console.log("ℹ️ [Filtered Out]: Notification not a transaction or bank match.");
      }
    } catch (err) {
      console.log("❌ [Listener Error]:", err);
    }
  }
};

// Register headless task in entry point so React Native headless engine finds it immediately
AppRegistry.registerHeadlessTask(
  RNAndroidNotificationListenerHeadlessJsName,
  () => headlessNotificationListener
);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
registerRootComponent(App);
