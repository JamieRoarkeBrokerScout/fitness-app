import { AppText, Button, Field } from '@/components/ui/primitives';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { addMeasurement } from '@/database/bodyQueries';
import { useSettings } from '@/hooks/use-settings';
import { circumferenceFields } from '@/lib/body-fields';
import { displayToCm, displayToKg, lengthLabel, parseDecimal, weightLabel } from '@/lib/units';
import { CircumferenceKey } from '@/types/body';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

export default function MeasureScreen() {
  const db = useSQLiteContext();
  const { units } = useSettings();
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [circumferences, setCircumferences] = useState<Partial<Record<CircumferenceKey, string>>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const weightValue = parseDecimal(weight);
    const bodyFatValue = parseDecimal(bodyFat);
    const lengths = Object.fromEntries(
      circumferenceFields.map(({ key }) => {
        const value = parseDecimal(circumferences[key] ?? '');
        return [key, value === null ? null : displayToCm(value, units)];
      })
    ) as Record<CircumferenceKey, number | null>;

    if (weightValue === null && bodyFatValue === null && Object.values(lengths).every((value) => value === null)) {
      setError('Enter at least one measurement.');
      return;
    }
    if (bodyFatValue !== null && (bodyFatValue <= 0 || bodyFatValue >= 70)) {
      setError('Body fat should be a percentage, like 18.5.');
      return;
    }

    setSaving(true);
    try {
      await addMeasurement(db, {
        measured_at: new Date().toISOString(),
        weight_kg: weightValue === null ? null : displayToKg(weightValue, units),
        body_fat_pct: bodyFatValue,
        ...lengths,
        notes: notes.trim() || null,
      });
      router.back();
    } catch (saveError) {
      console.error('Failed to save measurement:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Unknown error');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText color="textSecondary">Fill in what you measured today. Blank fields are skipped.</AppText>
        <View style={styles.row}>
          <Field label="Bodyweight" suffix={weightLabel(units)} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" autoFocus />
          <Field label="Body fat" suffix="%" value={bodyFat} onChangeText={setBodyFat} keyboardType="decimal-pad" />
        </View>
        {[0, 2, 4].map((start) => (
          <View key={start} style={styles.row}>
            {circumferenceFields.slice(start, start + 2).map(({ key, label }) => (
              <Field
                key={key}
                label={label}
                suffix={lengthLabel(units)}
                value={circumferences[key] ?? ''}
                onChangeText={(text) => setCircumferences((current) => ({ ...current, [key]: text }))}
                keyboardType="decimal-pad"
              />
            ))}
          </View>
        ))}
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Morning, before breakfast" />
        {error && <AppText color="danger">{error}</AppText>}
        <Button label="Save measurements" onPress={handleSave} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
});
