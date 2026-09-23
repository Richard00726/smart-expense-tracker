const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withNotificationListenerService(config) {
  return withAndroidManifest(config, async config => {
    const androidManifest = config.modResults;

    // Add service to <application>
    const app = androidManifest.manifest.application[0];
    
    if (!app.service) {
      app.service = [];
    }

    // Check if the service already exists to prevent duplication
    const hasService = app.service.some(
      s => s.$['android:name'] === 'com.leandrosimoes.reactnativeandroidnotificationlistener.RNAndroidNotificationListener'
    );

    if (!hasService) {
      app.service.push({
        $: {
          'android:name': 'com.leandrosimoes.reactnativeandroidnotificationlistener.RNAndroidNotificationListener',
          'android:label': '@string/app_name',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE'
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.service.notification.NotificationListenerService'
                }
              }
            ]
          }
        ]
      });
    }

    return config;
  });
};
