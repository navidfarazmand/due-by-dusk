import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.khoreh.duebydusk',
  appName: 'Due by Dusk',
  webDir: 'dist',
  backgroundColor: '#1b2119',
  loggingBehavior: 'debug',
  plugins: {
    SystemBars: {
      hidden: true,
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
    // 0.17: the game's reminders (platform/notify.ts) wear its own small icon in its gold
    LocalNotifications: {
      smallIcon: 'ic_stat_dbd',
      iconColor: '#FFC23D',
    },
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
  },
};

export default config;
