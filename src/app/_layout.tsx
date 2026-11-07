
import {
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  useFonts,
} from '@expo-google-fonts/barlow-condensed';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { initializeDatabase } from '@/database/database';
import { SettingsProvider } from '@/hooks/use-settings';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'light' ? 'light' : 'dark'];
  const [fontsLoaded, fontError] = useFonts({
    BarlowCondensed_500Medium,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  const base = scheme === 'light' ? DefaultTheme : DarkTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      primary: colors.text,
    },
  };

  return (
    <Suspense
      fallback={
        <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      }>
      <SQLiteProvider databaseName="fitness.db" onInit={initializeDatabase} useSuspense>
        <SettingsProvider>
          <ThemeProvider value={navigationTheme}>
            <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.text,
                headerShadowVisible: false,
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: { backgroundColor: colors.background },
              }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="workout/active"
                options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }}
              />
              <Stack.Screen name="workout/add-exercise" options={{ title: 'Add exercise', presentation: 'modal' }} />
              <Stack.Screen name="workout/[id]" options={{ title: '' }} />
              <Stack.Screen name="body/measure" options={{ title: 'Log measurements', presentation: 'modal' }} />
              <Stack.Screen name="body/photo/[id]" options={{ title: '' }} />
              <Stack.Screen name="settings" options={{ title: 'Settings' }} />
              <Stack.Screen name="whoop" options={{ headerShown: false, animation: 'none' }} />
            </Stack>
          </ThemeProvider>
        </SettingsProvider>
      </SQLiteProvider>
    </Suspense>
  );
}
