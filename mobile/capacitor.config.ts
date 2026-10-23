import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.navidfarazmand.duebydusk',
  appName: 'Due by Dusk',
  webDir: 'dist',
  backgroundColor: '#1b2119',
  loggingBehavior: 'debug',
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
