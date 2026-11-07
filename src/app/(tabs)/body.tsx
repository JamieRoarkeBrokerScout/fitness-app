import { LineChart } from '@/components/ui/charts';
import { AppText, Button, Divider, EmptyState, Icons, Panel, SectionHeader, Segmented, Stat } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { addPhoto, deleteMeasurement, getMeasurements, getPhotos } from '@/database/bodyQueries';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { circumferenceFields } from '@/lib/body-fields';
import { addDays, dateKey, daysIn } from '@/lib/dates';
import { photoUri, savePhoto } from '@/lib/photos';
import { cmToDisplay, formatNumber, kgToDisplay, lengthLabel, weightLabel } from '@/lib/units';
import { BodyMeasurement, PhotoPose } from '@/types/body';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

// Most recent non-empty value of a field, and the one before it, for "change since last".
function latestTwo(measurements: BodyMeasurement[], field: keyof BodyMeasurement) {
  const values = measurements.map((m) => m[field]).filter((value): value is number => typeof value === 'number');
  return { latest: values[0] ?? null, prior: values[1] ?? null };
}

function signed(value: number, digits = 1) {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), digits)}`;
}

export default function BodyScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { units } = useSettings();
  const { width } = useWindowDimensions();
  const [pose, setPose] = useState<PhotoPose>('front');
  const [saving, setSaving] = useState(false);

  const { data, reload } = useFocusQuery(async (database) => {
    const [measurements, photos] = await Promise.all([getMeasurements(database), getPhotos(database)]);
    return { measurements, photos };
  });

  const measurements = data?.measurements ?? [];
  const photos = data?.photos ?? [];
  const weight = latestTwo(measurements, 'weight_kg');
  const bodyFat = latestTwo(measurements, 'body_fat_pct');

  // 90-day weight trend, one point per day
  const trendDays = daysIn({ kind: 'month', start: addDays(new Date(), -89), end: addDays(new Date(), 1) });
  const weightByDay = new Map<string, number>();
  for (const measurement of [...measurements].reverse()) {
    if (measurement.weight_kg !== null) {
      weightByDay.set(dateKey(new Date(measurement.measured_at)), kgToDisplay(measurement.weight_kg, units));
    }
  }
  const trend = trendDays.map((day) => weightByDay.get(dateKey(day)) ?? null);
  const trendLabels = trendDays.map((day) => day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  const hasTrend = trend.filter((value) => value !== null).length > 1;

  const addFrom = async (source: 'camera' | 'library') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        source === 'camera' ? 'Camera access is off' : 'Photo access is off',
        'Turn it on for this app in your phone’s Settings to add progress photos.'
      );
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [3, 4] };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || result.assets.length === 0) {
      return;
    }
    setSaving(true);
    try {
      const fileName = savePhoto(result.assets[0].uri);
      await addPhoto(db, fileName, pose, new Date().toISOString());
      await reload();
    } catch (error) {
      console.error('Failed to save photo:', error);
      Alert.alert('The photo did not save', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const tile = (Math.min(width, 800) - Spacing.three * 2 - Spacing.two * 2) / 3;

  return (
    <Screen title="Body" onRefresh={reload}>
      <View style={styles.row}>
        <Stat
          value={weight.latest !== null ? formatNumber(kgToDisplay(weight.latest, units)) : '–'}
          unit={weightLabel(units)}
          label={weight.latest !== null && weight.prior !== null
            ? `${signed(kgToDisplay(weight.latest - weight.prior, units))} since last`
            : 'bodyweight'}
        />
        <Stat
          value={bodyFat.latest !== null ? formatNumber(bodyFat.latest) : '–'}
          unit="%"
          label={bodyFat.latest !== null && bodyFat.prior !== null ? `${signed(bodyFat.latest - bodyFat.prior)} since last` : 'body fat'}
        />
      </View>

      {hasTrend && (
        <Panel style={{ gap: Spacing.two }}>
          <AppText variant="caption" color="textSecondary">Last 90 days</AppText>
          <LineChart values={trend} labels={trendLabels} color={theme.text} format={(value) => formatNumber(value)} />
        </Panel>
      )}

      <View style={styles.grid}>
        {circumferenceFields.map(({ key, label }) => {
          const value = latestTwo(measurements, key);
          return (
            <View key={key} style={styles.gridItem}>
              <Stat
                value={value.latest !== null ? formatNumber(cmToDisplay(value.latest, units)) : '–'}
                unit={lengthLabel(units)}
                label={value.latest !== null && value.prior !== null
                  ? `${label}, ${signed(cmToDisplay(value.latest - value.prior, units))}`
                  : label}
              />
            </View>
          );
        })}
      </View>

      <Button label="Log measurements" icon={Icons.ruler} onPress={() => router.push('/body/measure')} />

      <SectionHeader title="Progress photos" />
      <Segmented
        options={[
          { value: 'front', label: 'Front' },
          { value: 'side', label: 'Side' },
          { value: 'back', label: 'Back' },
        ]}
        value={pose}
        onChange={setPose}
      />
      <View style={styles.row}>
        <Button kind="secondary" label="Take photo" icon={Icons.camera} onPress={() => addFrom('camera')} loading={saving} style={styles.flex} />
        <Button kind="secondary" label="Library" icon={Icons.photo} onPress={() => addFrom('library')} disabled={saving} style={styles.flex} />
      </View>

      {photos.length === 0 ? (
        <EmptyState
          title="No photos yet"
          body="Take one front, side and back photo in the same spot and light every few weeks. Changes the mirror misses show up side by side."
        />
      ) : (
        <View style={styles.photos}>
          {photos.map((photo) => (
            <Pressable
              key={photo.id}
              accessibilityRole="imagebutton"
              accessibilityLabel={`${photo.pose} photo from ${new Date(photo.taken_at).toLocaleDateString()}`}
              onPress={() => router.push({ pathname: '/body/photo/[id]', params: { id: photo.id } })}>
              <Image source={{ uri: photoUri(photo.file_name) }} style={[styles.photo, { width: tile, height: tile * (4 / 3), backgroundColor: theme.backgroundElement }]} contentFit="cover" />
              <AppText variant="caption" color="textSecondary" style={styles.photoCaption}>
                {new Date(photo.taken_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, {photo.pose}
              </AppText>
            </Pressable>
          ))}
        </View>
      )}

      {measurements.length > 0 && (
        <>
          <SectionHeader title="History" />
          <AppText variant="caption" color="textSecondary">Long press an entry to delete it.</AppText>
          {measurements.slice(0, 30).map((measurement, index) => (
            <View key={measurement.id}>
              {index > 0 && <Divider />}
              <Pressable
                onLongPress={() =>
                  Alert.alert('Delete this entry?', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        await deleteMeasurement(db, measurement.id);
                        await reload();
                      },
                    },
                  ])
                }
                style={styles.historyRow}>
                <AppText variant="bodyStrong" style={{ width: 90 }}>
                  {new Date(measurement.measured_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </AppText>
                <AppText color="textSecondary" style={styles.flex} numberOfLines={2}>
                  {describeMeasurement(measurement, units)}
                </AppText>
              </Pressable>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

function describeMeasurement(measurement: BodyMeasurement, units: 'lb' | 'kg') {
  const parts: string[] = [];
  if (measurement.weight_kg !== null) {
    parts.push(`${formatNumber(kgToDisplay(measurement.weight_kg, units))} ${weightLabel(units)}`);
  }
  if (measurement.body_fat_pct !== null) {
    parts.push(`${formatNumber(measurement.body_fat_pct)}% fat`);
  }
  for (const { key, label } of circumferenceFields) {
    const value = measurement[key];
    if (value !== null) {
      parts.push(`${label.toLowerCase()} ${formatNumber(cmToDisplay(value, units))}`);
    }
  }
  if (measurement.notes === 'MyFitnessPal') {
    parts.push('from MyFitnessPal');
  }
  return parts.join(', ');
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.three,
  },
  gridItem: {
    width: '33.33%',
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  photo: {
    borderRadius: Radius.small,
  },
  photoCaption: {
    marginTop: 4,
    textTransform: 'capitalize',
  },
  historyRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: Spacing.two + 2,
  },
});
