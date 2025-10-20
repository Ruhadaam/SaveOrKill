import React, { useEffect, useState } from "react";
import { View, Image, ActivityIndicator, Text, TouchableOpacity,StyleSheet } from "react-native";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassView, GlassContainer } from 'expo-glass-effect';
import Animated, { FadeInRight, FadeOutLeft } from "react-native-reanimated";

export default function StartAlbumPhotos() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [deletedPhotos, setDeletedPhotos] = useState<MediaLibrary.Asset[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const page = await MediaLibrary.getAssetsAsync({
          album: String(albumId),
          mediaType: MediaLibrary.MediaType.photo,
          first: 2000,
          sortBy: MediaLibrary.SortBy.creationTime,
        });
        setAssets(page.assets);
        setCurrentIndex(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [albumId]);

  useEffect(() => {
    (async () => {
      const asset = assets[currentIndex];
      if (!asset) {
        setResolvedUri(null);
        return;
      }
      const info = await MediaLibrary.getAssetInfoAsync(asset.id);
      setResolvedUri(info.localUri || asset.uri);
    })();
  }, [currentIndex, assets]);

  const goNext = () => {
    if (currentIndex < assets.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const deleteCurrentPhoto = () => {
    const currentPhoto = assets[currentIndex];
    if (currentPhoto) {
      // Add current photo to deleted photos array
      setDeletedPhotos(prev => [...prev, currentPhoto]);
      
      // Move to next photo
      if (currentIndex < assets.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        // If this is the last photo, go back to previous
        if (currentIndex > 0) {
          setCurrentIndex((i) => i - 1);
        }
      }
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (!assets.length) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text>Bu albümde fotoğraf bulunamadı.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="flex-1 items-center pt-8 ">
        {resolvedUri ? (
          <Animated.View
            key={assets[currentIndex]?.id}
            entering={FadeInRight.duration(200)}
            exiting={FadeOutLeft.duration(200)}
            className="w-11/12 h-2/3 rounded-3xl overflow-hidden shadow-2xl"
            style={{ backgroundColor: '#000' }}
          >
            <Image
              source={{ uri: resolvedUri }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </Animated.View>
        ) : (
          <View className="w-11/12 h-3/5 items-center justify-center">
            <Text className="text-white">Görsel yüklenemedi</Text>
          </View>
        )}
      </View>

      <View className="absolute inset-x-0 bottom-0 items-center justify-center" style={{ paddingBottom: insets.bottom + 75 }}>
      <GlassContainer spacing={12} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}> 
        <TouchableOpacity accessibilityLabel="Geri Al" activeOpacity={0.85}>
          <GlassView style={styles.glassSmall} isInteractive>
            <View className="flex-1 items-center justify-center">
              <Text className="text-black text-3xl">↺</Text>
            </View>
          </GlassView>
        </TouchableOpacity>

        <TouchableOpacity accessibilityLabel="Sil" activeOpacity={0.9} onPress={deleteCurrentPhoto}>
          <GlassView style={styles.glassLarge} isInteractive>
            <View className="flex-1 items-center justify-center">
              <Text className="text-blue-400 text-4xl">❌</Text>
            </View>
          </GlassView>
        </TouchableOpacity>

        <TouchableOpacity accessibilityLabel="Geç" activeOpacity={0.85} onPress={goNext}>
          <GlassView style={styles.glassSmall} isInteractive>
            <View className="flex-1 items-center justify-center">
              <Text className="text-pink-500 text-3xl">➜</Text>
            </View>
          </GlassView>
        </TouchableOpacity>
      </GlassContainer>
      </View>

    
    </View>
  );
}



 const styles = StyleSheet.create({
   glassSmall: {
     width: 64,
     height: 64,
     borderRadius: 32,
   },
   glassLarge: {
     width: 84,
     height: 84,
     borderRadius: 42,
     marginHorizontal: 12,
   },
 });