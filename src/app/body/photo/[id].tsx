import { AppText, Button, Segmented } from '@/components/ui/primitives';
import { Radius, Spacing } from '@/constants/theme';
import { deletePhotoRow, getPhoto, getPhotos } from '@/database/bodyQueries';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useTheme } from '@/hooks/use-theme';
import { deletePhotoFile, photoUri } from '@/lib/photos';
import { ProgressPhoto } from '@/types/body';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

function formatDate(photo: ProgressPhoto) {
  return new Date(photo.taken_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PhotoScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [mode, setMode] = useState<'single' | 'compare'>('single');

  const { data } = useFocusQuery(async (database) => {
    const photo = await getPhoto(database, id);
    if (!photo) {
      return null;
    }
    // compare against your first photo in this pose; if this is the first, against the latest
    const samePose = (await getPhotos(database)).filter((other) => other.pose === photo.pose && other.id !== photo.id);
    if (samePose.length === 0) {
      return { photo, earliest: null };
    }
    const first = samePose[samePose.length - 1];
    return { photo, earliest: first.taken_at < photo.taken_at ? first : samePose[0] };
  }, [id]);

  if (!data) {
    return <View style={styles.flex} />;
  }
  const { photo, earliest } = data;

  const handleDelete = () => {
    Alert.alert('Delete this photo?', 'It will be removed from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePhotoRow(db, photo.id);
          deletePhotoFile(photo.file_name);
          router.back();
        },
      },
    ]);
  };

  const imageStyle = [styles.image, { backgroundColor: theme.backgroundElement }];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: `${photo.pose[0].toUpperCase()}${photo.pose.slice(1)}, ${formatDate(photo)}` }} />
      {earliest && (
        <Segmented
          options={[
            { value: 'single', label: 'This photo' },
            { value: 'compare', label: `Compare with ${formatDate(earliest)}` },
          ]}
          value={mode}
          onChange={setMode}
        />
      )}
      {mode === 'compare' && earliest ? (
        <View style={styles.compare}>
          {[earliest, photo]
            .sort((a, b) => a.taken_at.localeCompare(b.taken_at))
            .map((item) => (
              <View key={item.id} style={styles.flex}>
                <Image source={{ uri: photoUri(item.file_name) }} style={imageStyle} contentFit="cover" />
                <AppText variant="caption" color="textSecondary" style={styles.caption}>{formatDate(item)}</AppText>
              </View>
            ))}
        </View>
      ) : (
        <Image source={{ uri: photoUri(photo.file_name) }} style={imageStyle} contentFit="cover" />
      )}
      <Button kind="danger" label="Delete photo" onPress={handleDelete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: Radius.medium,
  },
  compare: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  caption: {
    textAlign: 'center',
    marginTop: Spacing.one,
  },
});
