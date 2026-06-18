import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nursejk.assistant',
  appName: 'NurseJK Assistant',

  server: {
    url: 'https://nursejk-assistant-q1oe.onrender.com',
    cleartext: true
  },

  android: {
    backgroundColor: "#ffffff"
  }
};

export default config;