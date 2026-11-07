import { AppText, Button, Divider, Icons, Panel, Segmented } from '@/components/ui/primitives';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { clearWhoopData, getNutritionStats } from '@/database/healthQueries';
import { setSetting } from '@/database/settingsQueries';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useSettings } from '@/hooks/use-settings';
import { useWhoop } from '@/hooks/use-whoop';
import { useWhoopConnect, whoopRedirectUri } from '@/hooks/use-whoop-connect';
import { ImportError, importMyFitnessPalCsv } from '@/lib/nutrition/mfp-import';
import { clearTokens } from '@/lib/whoop/client';
import { isWhoopConfigured } from '@/lib/whoop/config';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

function formatDay(key: string) {
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { units, setUnits } = useSettings();
  const whoop = useWhoop();
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const { data: nutritionStats, reload: reloadNutrition } = useFocusQuery((database) => getNutritionStats(database));

  const { refreshStatus, sync } = whoop;
  const onConnected = useCallback(() => {
    void refreshStatus().then(() => sync());
  }, [refreshStatus, sync]);
  const connect = useWhoopConnect(onConnected);

  const handleDisconnect = () => {
    Alert.alert('Disconnect WHOOP?', 'Synced WHOOP data is removed from this phone. Your workouts stay.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await clearTokens();
          await clearWhoopData(db);
          await setSetting(db, 'whoop_last_sync', null);
          await whoop.refreshStatus();
        },
      },
    ]);
  };

  const handleImport = async () => {
    setImportMessage(null);
    const result = await DocumentPicker.getDocumentAsync({
      // some Android file managers label CSVs oddly, so accept anything and check the header
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled || result.assets.length === 0) {
      return;
    }
    setImporting(true);
    try {
      const text = await new File(result.assets[0].uri).text();
      const imported = await importMyFitnessPalCsv(db, text, units);
      setImportMessage(
        imported.kind === 'nutrition'
          ? `Imported nutrition for ${imported.days} days, ${formatDay(imported.first)} to ${formatDay(imported.last)}.`
          : `Imported ${imported.days} weigh-ins, ${formatDay(imported.first)} to ${formatDay(imported.last)}. They're on the Body tab.`
      );
      await reloadNutrition();
    } catch (error) {
      console.error('MyFitnessPal import failed:', error);
      setImportMessage(error instanceof ImportError ? error.message : 'That file could not be read. Pick a CSV from the MyFitnessPal export.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <AppText variant="heading">Units</AppText>
        <Segmented
          options={[
            { value: 'lb', label: 'Pounds and inches' },
            { value: 'kg', label: 'Kilograms and cm' },
          ]}
          value={units}
          onChange={setUnits}
        />
      </View>

      <Divider />

      <View style={styles.section}>
        <AppText variant="heading">WHOOP</AppText>
        {!isWhoopConfigured() ? (
          <Panel style={styles.section}>
            <AppText variant="bodyStrong">Add your WHOOP app credentials</AppText>
            <AppText color="textSecondary">
              Create an app at developer.whoop.com, then put its client ID and secret in a file called .env.local in the
              project folder:
            </AppText>
            <AppText style={styles.code}>EXPO_PUBLIC_WHOOP_CLIENT_ID=…{'\n'}WHOOP_CLIENT_SECRET=…</AppText>
            <AppText color="textSecondary">Then add this redirect URL to the WHOOP app and restart the dev server:</AppText>
            <AppText selectable style={styles.code}>{whoopRedirectUri}</AppText>
          </Panel>
        ) : whoop.connected ? (
          <>
            <AppText color="textSecondary">
              {whoop.syncing
                ? 'Syncing…'
                : whoop.lastSync
                  ? `Connected. Last synced ${new Date(whoop.lastSync).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`
                  : 'Connected. Not synced yet.'}
            </AppText>
            <View style={styles.row}>
              <Button kind="secondary" label="Sync now" icon={Icons.sync} onPress={whoop.sync} loading={whoop.syncing} style={styles.flex} />
              <Button kind="danger" label="Disconnect" onPress={handleDisconnect} style={styles.flex} />
            </View>
          </>
        ) : (
          <>
            <AppText color="textSecondary">
              Pulls recovery, strain, sleep and WHOOP-tracked activities. The first sync fetches the last 90 days.
            </AppText>
            <Button
              label="Connect WHOOP"
              onPress={connect.connect}
              disabled={!connect.ready}
              loading={connect.exchanging}
            />
            <AppText variant="caption" color="textSecondary">
              This redirect URL must be listed in your WHOOP developer app: <AppText variant="caption" selectable>{whoopRedirectUri}</AppText>
            </AppText>
          </>
        )}
        {connect.error && <AppText color="danger">{connect.error}</AppText>}
        {whoop.error && <AppText color="danger">{whoop.error}</AppText>}
      </View>

      <Divider />

      <View style={styles.section}>
        <AppText variant="heading">MyFitnessPal</AppText>
        <AppText color="textSecondary">
          MyFitnessPal doesn’t let other apps connect directly, so import your data from its export instead:
        </AppText>
        <AppText color="textSecondary">
          1. In MyFitnessPal, open Settings, then Export data (Premium). You’ll get an email with a zip file.{'\n'}
          2. Unzip it in your Files app.{'\n'}
          3. Import Nutrition-Summary for calories and macros, and Measurement-Summary for bodyweight.
        </AppText>
        {nutritionStats && nutritionStats.days > 0 && nutritionStats.first && nutritionStats.last && (
          <AppText>
            {nutritionStats.days} days of nutrition imported, {formatDay(nutritionStats.first)} to {formatDay(nutritionStats.last)}.
          </AppText>
        )}
        <Button kind="secondary" label="Import CSV file" icon={Icons.fork} onPress={handleImport} loading={importing} />
        {importMessage && <AppText>{importMessage}</AppText>}
        <AppText variant="caption" color="textSecondary">
          Weigh-ins are read in the unit chosen above ({units}). Importing the same file again updates days instead of duplicating them.
        </AppText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  section: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 13,
  },
});
