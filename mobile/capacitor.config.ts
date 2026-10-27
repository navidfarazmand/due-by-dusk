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
