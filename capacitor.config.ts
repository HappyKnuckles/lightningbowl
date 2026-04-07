import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.lightningbowl',
  appName: 'Lightning Bowl',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
};

export default config;
