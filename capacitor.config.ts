import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.caderneta.app',
  appName: 'Caderneta',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'native',
      style: 'dark',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
