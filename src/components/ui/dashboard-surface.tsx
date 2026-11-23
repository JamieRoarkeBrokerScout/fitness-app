import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, ImageBackground, Platform, StyleSheet, View } from 'react-native';

const GlassPreference = createContext(false);

export function DashboardMaterials({ children }: { children: ReactNode }) {
  const [glass, setGlass] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios' || !isLiquidGlassAvailable()) return;
    let current = true;
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', reduced => {
      current = false;
      setGlass(!reduced);
    });
    void AccessibilityInfo.isReduceTransparencyEnabled().then(reduced => {
      if (current) setGlass(!reduced);
    });
    return () => { current = false; subscription.remove(); };
  }, []);
  return <GlassPreference.Provider value={glass}>{children}</GlassPreference.Provider>;
}

export function useDashboardGlass() {
  return useContext(GlassPreference);
}

export function DashboardSurface({ children }: { children: ReactNode }) {
  return (
    <ImageBackground source={require('../../../assets/images/training-floor.jpg')} resizeMode="cover" style={styles.floor}>
      <View pointerEvents="none" style={styles.shade} />
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  floor: { flex: 1, backgroundColor: '#171A19' },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12,15,14,0.84)' },
});
