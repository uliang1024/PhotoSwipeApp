import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator, TouchableOpacity, Alert, Dimensions, Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import Swiper from 'react-native-deck-swiper';
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { PhotoCard } from "@/components/PhotoCard";
import { PhotoListModal } from "@/components/PhotoListModal";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function HomeScreen() {
  const [photos, setPhotos] = useState<MediaLibrary.Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteList, setDeleteList] = useState<string[]>([]);
  const [isListVisible, setIsListVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const swiperRef = useRef<any>(null);

  useEffect(() => { loadPhotos(); }, []);

  const loadPhotos = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') return;
    const { assets } = await MediaLibrary.getAssetsAsync({ first: 100, mediaType: 'photo' });
    setPhotos(assets);
    setLoading(false);
  };

  const executeDelete = async () => {
    await MediaLibrary.deleteAssetsAsync(deleteList);
    setDeleteList([]);
    loadPhotos();
  };

  if (loading) return <ThemedView style={styles.center}><ActivityIndicator /></ThemedView>;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View>
          <ThemedText type="title">PhotoSwipe</ThemedText>
          <ThemedText style={{color: '#888'}}>待處理: {deleteList.length} 張</ThemedText>
        </View>
        <TouchableOpacity onPress={() => setIsListVisible(true)}>
          <Ionicons name="grid-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.swiperBox}>
        <Swiper
          ref={swiperRef}
          cards={photos}
          renderCard={(photo) => <PhotoCard photo={photo} />}
          onSwipedLeft={(i) => setDeleteList([...deleteList, photos[i].id])}
          cardIndex={currentIndex}
          backgroundColor="transparent"
          stackSize={3}
          containerStyle={styles.swiperInner}
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.actionBtn} onPress={executeDelete}>
          <ThemedText style={{color: 'white'}}>確認清理 ({deleteList.length})</ThemedText>
        </TouchableOpacity>
      </View>

      <PhotoListModal 
        visible={isListVisible}
        photos={photos}
        deleteList={deleteList}
        currentIndex={currentIndex}
        onClose={() => setIsListVisible(false)}
        onSelect={(i) => { setCurrentIndex(i); swiperRef.current?.jumpToCardIndex(i); setIsListVisible(false); }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center' },
  header: { paddingTop: 60, height: 140, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 25 },
  swiperBox: { flex: 1, overflow: 'hidden' },
  swiperInner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center' },
  footer: { height: 140, justifyContent: 'center', alignItems: 'center', paddingBottom: 40 },
  actionBtn: { backgroundColor: '#FF3B30', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30 },
});