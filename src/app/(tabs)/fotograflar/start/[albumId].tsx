import React, { useEffect, useState, useLayoutEffect } from "react";
import { View, Image, ActivityIndicator, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassView, GlassContainer } from 'expo-glass-effect';
import Animated, { FadeInRight, FadeOutLeft } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";

export default function StartAlbumPhotos() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [deletedPhotos, setDeletedPhotos] = useState<string[]>([]);
  const [showDeleteAnimation, setShowDeleteAnimation] = useState(false);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

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
    } else {
      Alert.alert(
        "Bilgi",
        "Bu albümdeki son fotoğrafta bulunuyorsunuz."
      );
    }
  };

  const undoLastDelete = () => {
    if (deletedPhotos.length > 0) {
      // Remove the last deleted photo from the array
      setDeletedPhotos(prev => prev.slice(0, -1));
      
      // Go back to previous photo
      if (currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      }
    }
  };

  const deleteCurrentPhoto = () => {
    // If all photos are already deleted, don't do anything
    if (deletedPhotos.length >= assets.length) {
      return;
    }

    const currentPhoto = assets[currentIndex];
    if (currentPhoto) {
      const willBeLast = deletedPhotos.length + 1 === assets.length;
      
      // Add current photo ID to deleted photos array
      setDeletedPhotos(prev => [...prev, currentPhoto.id]);
      
      // If this was the last photo, show alert and stop
      if (willBeLast) {
        Alert.alert(
          "Bilgi",
          "Tüm fotoğraflar silindi. Başka fotoğraf kalmadı."
        );
        return;
      }
      
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

  const handleDeleteAll = async () => {
    if (deletedPhotos.length === 0) {
      Alert.alert("Bilgi", "Silinecek fotoğraf bulunamadı.");
      return;
    }

    Alert.alert(
      "Fotoğrafları Sil",
      `${deletedPhotos.length} fotoğrafı galeriden silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            setShowDeleteAnimation(true);
            try {
              // Delete all photos from gallery in one go
              await MediaLibrary.deleteAssetsAsync(deletedPhotos);
              
              // Wait a bit for the animation
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Navigate back to album list and then back to photos to refresh
              router.replace(`/(tabs)/fotograflar/${albumId}`);
              
              // Small delay then go back to album list
              setTimeout(() => {
                router.replace("/(tabs)/fotograflar");
              }, 100);
            } catch (error) {
              console.error("Error deleting photos:", error);
              Alert.alert("Hata", "Fotoğraflar silinirken bir hata oluştu.");
              setShowDeleteAnimation(false);
            }
          },
        },
      ]
    );
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handleDeleteAll}
          className="mr-2 pr-3 pl-5 py-1"
        >
          <Text className="text-red-600 font-semibold">Sil</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, deletedPhotos]);

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

  const progress = assets.length > 0 ? deletedPhotos.length / assets.length : 0;
  const currentPhotoNumber = currentIndex + 1;

  return (
    <View className="flex-1">
      {/* Delete Animation Overlay */}
      {showDeleteAnimation && (
        <View className="absolute inset-0 bg-black/80 items-center justify-center z-50">
          <View className="bg-white rounded-2xl p-8 items-center justify-center">
            <Text className="text-2xl mb-2">🗑️</Text>
            <Text className="text-lg font-semibold mb-2">Fotoğraflar siliniyor...</Text>
            <ActivityIndicator size="large" color="#0066FF" />
          </View>
        </View>
      )}

      {/* Progress Bar at the top */}
      <View className="absolute inset-x-0 top-0" style={{ paddingTop: insets.top - 30, paddingHorizontal: 20, zIndex: 1000 }}>
        <GlassContainer style={{ borderRadius: 20, overflow: 'hidden' }}>
          <GlassView style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-black text-sm font-semibold">
                {currentPhotoNumber} / {assets.length}
              </Text>
              <Text className="text-black text-sm">
                {deletedPhotos.length} silindi
              </Text>
            </View>
            <View className="h-2 bg-gray-300/50 rounded-full overflow-hidden">
              <View 
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${progress * 100}%` }}
              />
            </View>
          </GlassView>
        </GlassContainer>
      </View>

      <View className="flex-1 items-center pt-24 ">
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
        <TouchableOpacity accessibilityLabel="Geri Al" activeOpacity={0.85} onPress={undoLastDelete}>
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