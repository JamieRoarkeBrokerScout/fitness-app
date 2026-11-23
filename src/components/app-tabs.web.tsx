import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import type { ComponentProps } from 'react';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/ui/primitives';
import { Display, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Today</TabButton>
          </TabTrigger>
          <TabTrigger name="history" href="/history" asChild>
            <TabButton>Workouts</TabButton>
          </TabTrigger>
          <TabTrigger name="progress" href="/progress" asChild>
            <TabButton>Progress</TabButton>
          </TabTrigger>
          <TabTrigger name="body" href="/body" asChild>
            <TabButton>Body</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();
  return (
    <Pressable {...(props as ComponentProps<typeof Pressable>)} style={({ pressed }) => pressed && styles.pressed}>
      <View style={[styles.tabButtonView, { backgroundColor: isFocused ? theme.backgroundSelected : 'transparent' }]}>
        <AppText variant="bodyStrong" color={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </AppText>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const theme = useTheme();
  // four tabs fill a phone-width bar, so the brand only shows when there's room for it
  const showBrand = useWindowDimensions().width >= 560;

  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={[styles.innerContainer, { backgroundColor: theme.backgroundElement }, !showBrand && styles.innerContainerCompact]}>
        {showBrand && <AppText style={[styles.brandText, { fontFamily: Display.bold }]}>Fitness</AppText>}
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  innerContainerCompact: {
    paddingHorizontal: Spacing.one,
    gap: 0,
    justifyContent: 'space-between',
  },
  brandText: {
    marginRight: 'auto',
    fontSize: 20,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.two,
    paddingHorizontal: 12,
    borderRadius: Spacing.three,
  },
});
