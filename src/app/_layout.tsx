
import {
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  useFonts,
} from '@expo-google-fonts/barlow-condensed';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { DashboardMaterials } from '@/components/ui/dashboard-surface';
import { Colors } from '@/constants/theme';
import { initializeDatabase } from '@/database/database';
import { SettingsProvider } from '@/hooks/use-settings';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colors = Colors.dark;
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

  const base = DarkTheme;
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
          <DashboardMaterials>
          <ThemeProvider value={navigationTheme}>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.action,
                headerShadowVisible: false,
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: { backgroundColor: colors.background },
              }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="workout/active"
                options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }}
              />
              <Stack.Screen name="workout/add-exercise" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="workout/[id]" options={{ title: '' }} />
              <Stack.Screen name="body/measure" options={{ title: 'Log measurements', presentation: 'modal' }} />
              <Stack.Screen name="body/photo/[id]" options={{ title: '' }} />
              <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            </Stack>
          </ThemeProvider>
          </DashboardMaterials>
        </SettingsProvider>
      </SQLiteProvider>
    </Suspense>
  );
}
