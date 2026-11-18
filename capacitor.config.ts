import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.goteomed.aph',
  appName: 'GoteoMed APH',
  webDir: 'dist/goteo-med/browser',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_water_drop',
      iconColor: '#0284c7',
      sound: 'default',
    },
  },
};

export default config;
