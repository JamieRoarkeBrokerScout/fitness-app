import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

// WHOOP's OAuth redirect lands here on Android (the browser hands the URL to the app as a
// deep link). AuthSession has already picked up the code, so just step back to Settings.
export default function WhoopRedirect() {
  useEffect(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings');
    }
  }, []);
  return <View />;
}
