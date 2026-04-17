import { Modal, FlatList, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import * as MediaLibrary from 'expo-media-library';

interface Props {
  visible: boolean;
  photos: MediaLibrary.Asset[];
  deleteList: string[];
  currentIndex: number;
  onClose: () => void;
  onSelect: (index: number) => void;
}

export function PhotoListModal({ visible, photos, deleteList, currentIndex, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} animationType="slide">
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title">所有照片</ThemedText>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close-circle" size={32} color="#8E8E93" />
          </TouchableOpacity>
        </View>
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          numColumns={4}
          renderItem={({ item, index }) => (
            <TouchableOpacity 
              onPress={() => onSelect(index)}
              style={[styles.gridItem, currentIndex === index && styles.active]}
            >
              <Image source={{ uri: item.uri }} style={styles.gridImage} />
              {deleteList.includes(item.id) && (
                <View style={styles.badge}><Ionicons name="trash" size={10} color="white" /></View>
              )}
            </TouchableOpacity>
          )}
        />
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20 },
  gridItem: { flex: 1/4, aspectRatio: 1, padding: 2 },
  gridImage: { width: '100%', height: '100%', borderRadius: 4 },
  active: { borderWidth: 2, borderColor: '#007AFF' },
  badge: { position: 'absolute', top: 5, right: 5, backgroundColor: 'red', borderRadius: 10, padding: 2 },
});