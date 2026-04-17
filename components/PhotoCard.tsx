import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from './themed-text';
import * as MediaLibrary from 'expo-media-library';

interface Props {
  photo: MediaLibrary.Asset;
}

export function PhotoCard({ photo }: Props) {
  return (
    <View style={styles.card}>
      <Image source={{ uri: photo.uri }} style={styles.image} contentFit="cover" />
      <View style={styles.cardFooter}>
        <ThemedText style={styles.dateText}>
          {new Date(photo.creationTime).toLocaleDateString()}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { height: '100%', borderRadius: 24, backgroundColor: '#1c1c1e', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  cardFooter: { position: 'absolute', bottom: 0, width: '100%', padding: 15, backgroundColor: 'rgba(0,0,0,0.5)' },
  dateText: { color: 'white', fontSize: 12, opacity: 0.8 },
});