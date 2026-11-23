import { AppText, Button, Divider, Icons, Segmented } from '@/components/ui/primitives';
import { WhoopBandPanel } from '@/components/whoop-band-panel';
import { MaxContentWidth, Spacing, Layout } from '@/constants/theme';
import { getNutritionStats } from '@/database/healthQueries';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useSettings } from '@/hooks/use-settings';
import { ImportError, importMyFitnessPalCsv } from '@/lib/nutrition/mfp-import';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

function formatDay(key: string) {
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { units, setUnits } = useSettings();
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const { data: nutritionStats, reload: reloadNutrition } = useFocusQuery((database) => getNutritionStats(database));

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
        <AppText variant="heading">WHOOP band · direct Bluetooth</AppText>
        <WhoopBandPanel />
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
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.five - 4,
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
