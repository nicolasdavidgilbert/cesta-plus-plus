import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'site.insforge.cestapp',
  appName: 'Cesta++',
  webDir: 'public',
  server: {
    url: 'https://cestapp.insforge.site',
    cleartext: false,
  },
};

export default config;
