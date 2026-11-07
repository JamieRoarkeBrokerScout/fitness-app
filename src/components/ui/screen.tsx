import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ReactNode, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from './primitives';

// Standard tab screen: a large condensed title, an optional trailing control, and
// scrolling content. Pass onRefresh to enable pull-to-refresh.
export function Screen({
    title,
    subtitle,
    action,
    children,
    onRefresh,
}: {
    title: string,
    subtitle?: string,
    action?: ReactNode,
    children: ReactNode,
    onRefresh?: () => Promise<unknown>,
}) {
    const theme = useTheme();
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = async () => {
        if (!onRefresh) {
            return;
        }
        setRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.textSecondary} /> : undefined}>
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        {subtitle && <AppText variant="caption" color="textSecondary">{subtitle}</AppText>}
                        <AppText variant="title">{title}</AppText>
                    </View>
                    {action}
                </View>
                {children}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    content: {
        paddingHorizontal: Spacing.three,
        paddingBottom: BottomTabInset + Spacing.five,
        gap: Spacing.three,
        width: '100%',
        maxWidth: MaxContentWidth,
        alignSelf: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingTop: Spacing.three,
        gap: Spacing.two,
    },
});
