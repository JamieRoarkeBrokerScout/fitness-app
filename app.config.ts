import appJson from './app.json';
import type { ExpoConfig } from 'expo/config';

const config = {
  ...appJson.expo,
  extra: {
    eas: {
      projectId: 'a05c638d-0aba-4196-952d-f02be0c8a86b',
    },
  },
  plugins: appJson.expo.plugins.map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === 'expo-router') {
      return [
        'expo-router',
        {
          ...(plugin[1] as Record<string, unknown>),
        },
      ];
    }
    return plugin;
  }).concat([
    [
      'react-native-ble-plx',
      {
        bluetoothAlwaysPermission: 'Connect to your WHOOP band over Bluetooth.',
      },
    ],
  ]),
} as ExpoConfig;

export default config;
