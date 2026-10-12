
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Text, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { initializeDatabase } from '@/database/database';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Suspense fallback={<Text>Loading...</Text>}>
      <SQLiteProvider databaseName="fitness.db" onInit={initializeDatabase} useSuspense>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <AppTabs />
        </ThemeProvider>
      </SQLiteProvider>
    </Suspense>
  );
}
