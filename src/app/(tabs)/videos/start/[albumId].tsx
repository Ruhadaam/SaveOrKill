import React, { useEffect, useState, useLayoutEffect, useRef } from "react";
import { View, Image, ActivityIndicator, Text, TouchableOpacity, Alert, Platform, Dimensions,StyleSheet } from "react-native";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassView, GlassContainer } from 'expo-glass-effect';
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
  FadeInRight,
  FadeOutLeft,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
const { width: screenWidth } = Dimensions.get('window');
import { useVideoPlayer, VideoView } from 'expo-video';
import { getThumbnailAsync } from "expo-video-thumbnails";

export default function StartAlbumVideos() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [hasNextPage, setHasNextPage] = useState<boolean>(true);
  const [endCursor, setEndCursor] = useState<string | undefined>();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [deletedVideos, setDeletedVideos] = useState<string[]>([]);
  const [showDeleteAnimation, setShowDeleteAnimation] = useState(false);
  const videoRef = useRef<Video>(null);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  // Video player instance
  const translateX = useSharedValue(0);
  const rotation = useSharedValue(0);
  const likeOpacity = useSharedValue(0);
  const nopeOpacity = useSharedValue(0);

  const majorVersion = Platform.OS === 'ios' ? parseInt(String(Platform.Version), 10) : 0;
  const isIOS18 = majorVersion >= 18 && majorVersion < 26;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const page = await MediaLibrary.getAssetsAsync({
          album: String(albumId),
          mediaType: MediaLibrary.MediaType.video,
          first: 20,
          sortBy: MediaLibrary.SortBy.creationTime,
        });
        setAssets(page.assets);
        setEndCursor(page.endCursor);
        setHasNextPage(page.hasNextPage);
        setCurrentIndex(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [albumId]);

  useEffect(() => {
    translateX.value = 0;
    rotation.value = 0;
    likeOpacity.value = 0;
    nopeOpacity.value = 0;

    if (!assets.length) return;

    (async () => {
      const asset = assets[currentIndex];
      if (!asset) {
        console.warn("Video not found, skipping to next.");
        runOnJS(goNext)();
        return;
      }

      try {
        let info = await MediaLibrary.getAssetInfoAsync(asset, {
          shouldDownloadFromNetwork: true,
        });

        let uri = info.localUri || asset.uri;
        if (uri.startsWith("ph://") || uri.startsWith("assets-library://")) {
          try {
            const fileName = `${asset.filename || `video-${Date.now()}`}`;
            const tempPath = `${FileSystem.cacheDirectory}${fileName}`;
            await FileSystem.copyAsync({ from: asset.uri, to: tempPath });
            uri = tempPath;
            console.log("📦 Copied to cache:", uri);
          } catch (err) {
            console.warn("❗️FileSystem copy failed:", err);
          }
        }

        console.log("🎬 Final resolved URI:", uri);
        setResolvedUri(uri);
      } catch (e) {
        console.error("Error resolving video URI:", e);
        setResolvedUri(null);
      }
    })();
  }, [currentIndex, assets]);

  const player = useVideoPlayer(resolvedUri ?? '', (p) => {
    p.loop = false;
  });

  const onSwipe = (action: 'like' | 'nope') => {
    const offScreenX = (action === 'like' ? 1 : -1) * screenWidth * 1.5;
    translateX.value = withSpring(offScreenX);
    rotation.value = withSpring(interpolate(offScreenX, [-screenWidth, screenWidth], [-45, 45]));

    runOnJS(action === 'like' ? goNext : deleteCurrentVideo)();
  };

  const goNext = () => {
    if (currentIndex < assets.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else if (hasNextPage) {
      loadMoreAssets();
    } else {
      Alert.alert("Info", "You are at the last video in this album.");
    }
  };

  const loadMoreAssets = async () => {
    if (!hasNextPage || loading) return;

    setLoading(true);
    try {
      const page = await MediaLibrary.getAssetsAsync({
        album: String(albumId),
        mediaType: MediaLibrary.MediaType.video,
        first: 20,
        after: endCursor,
        sortBy: MediaLibrary.SortBy.creationTime,
      });

      if (page.assets.length > 0) {
        setAssets(prev => [...prev, ...page.assets]);
        setCurrentIndex(prev => prev + 1);
      }
      setEndCursor(page.endCursor);
      setHasNextPage(page.hasNextPage);
    } finally {
      setLoading(false);
    }
  };

  const undoLastDelete = () => {
    if (deletedVideos.length > 0) {
      setDeletedVideos(prev => prev.slice(0, -1));
      if (currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      }
    }
  };

  const deleteCurrentVideo = () => {
    if (deletedVideos.length >= assets.length) return;

    const currentVideo = assets[currentIndex];
    if (currentVideo) {
      const willBeLast = deletedVideos.length + 1 === assets.length;
      setDeletedVideos(prev => [...prev, currentVideo.id]);

      if (willBeLast) {
        Alert.alert("Info", "All videos have been deleted. There are no videos left.");
        return;
      }

      if (currentIndex < assets.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else if (currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      }
    }
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      rotation.value = interpolate(event.translationX, [-screenWidth / 2, screenWidth / 2], [-15, 15], Extrapolate.CLAMP);
      likeOpacity.value = interpolate(event.translationX, [20, 100], [0, 1], Extrapolate.CLAMP);
      nopeOpacity.value = interpolate(event.translationX, [-100, -20], [1, 0], Extrapolate.CLAMP);
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > 120) {
        runOnJS(onSwipe)(event.translationX > 0 ? 'like' : 'nope');
      } else {
        translateX.value = withSpring(0);
        rotation.value = withSpring(0);
      }
      likeOpacity.value = withTiming(0);
      nopeOpacity.value = withTiming(0);
    });

  const animatedStyle = useAnimatedStyle(() => {
    const rotationDeg = rotation.value;
    return {
      transform: [
        { translateX: translateX.value as any },
        { rotateZ: `${rotationDeg}deg` as any }
      ],
    } as any;
  });

  const likeLabelStyle = useAnimatedStyle(() => ({ opacity: likeOpacity.value }));
  const nopeLabelStyle = useAnimatedStyle(() => ({ opacity: nopeOpacity.value }));

  const handleDeleteAll = async () => {
    if (deletedVideos.length === 0) {
      Alert.alert("Info", "No videos to delete.");
      return;
    }
    Alert.alert(
      "Delete Videos",
      `Are you sure you want to delete ${deletedVideos.length} videos from the gallery? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setShowDeleteAnimation(true);
            try {
              await MediaLibrary.deleteAssetsAsync(deletedVideos);
              await new Promise(resolve => setTimeout(resolve, 2000));
              router.replace(`/(tabs)/videos/${albumId}`);
              setTimeout(() => router.replace("/(tabs)/videos"), 100);
            } catch (error) {
              console.error("Error deleting videos:", error);
              Alert.alert("Error", "An error occurred while deleting videos.");
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
        <TouchableOpacity onPress={handleDeleteAll} className="mr-2 pr-3 pl-5 py-1">
          <Text className="text-red-600 font-semibold">Delete</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, deletedVideos]);

  if (loading) return <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>;
  if (!assets.length) return <View className="flex-1 items-center justify-center p-6"><Text>No videos found in this album.</Text></View>;

  const progress = assets.length > 0 ? deletedVideos.length / assets.length : 0;
  const currentVideoNumber = currentIndex + 1;

  return (
    <View className="flex-1">
      {showDeleteAnimation && (
        <View className="absolute inset-0 bg-black/80 items-center justify-center z-50">
          <View className="bg-white rounded-2xl p-8 items-center justify-center">
            <Text className="text-2xl mb-2">🗑️</Text>
            <Text className="text-lg font-semibold mb-2">Deleting videos...</Text>
            <ActivityIndicator size="large" color="#0066FF" />
          </View>
        </View>
      )}
          {/** PROGRESS BAR */ }
      <View className="absolute inset-x-0 top-0" style={{ paddingTop: isIOS18 ? insets.top - 40 : insets.top - 30, paddingHorizontal: 20, zIndex: 1000 }}>
        {isIOS18 ? (
          <View style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: 'rgba(255, 255, 255, 0.9)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 }}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-black text-sm font-semibold">{currentVideoNumber} / {assets.length}</Text>
                <Text className="text-black text-sm">{deletedVideos.length} deleted</Text>
              </View>
              <View className="h-2 bg-gray-300/50 rounded-full overflow-hidden">
                <View className="h-full bg-blue-500 rounded-full" style={{ width: `${progress * 100}%` }} />
              </View>
            </View>
          </View>
        ) : (
          <GlassContainer style={{ borderRadius: 20, overflow: 'hidden' }}>
            <GlassView style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-black text-sm font-semibold">{currentVideoNumber} / {assets.length}</Text>
                <Text className="text-black text-sm">{deletedVideos.length} deleted</Text>
              </View>
              <View className="h-2 bg-gray-300/50 rounded-full overflow-hidden">
                <View className="h-full bg-blue-500 rounded-full" style={{ width: `${progress * 100}%` }} />
              </View>
            </GlassView>
          </GlassContainer>
        )}
      </View>
        {/* SİL SAKLA YAZILARI*/ }
      <View className="flex-1 items-center pt-24">
        <Animated.View className="absolute top-[40%] left-10 z-0 border-[5px] rounded-xl px-4 py-2 rotate-[-25deg]" style={[{ borderColor: '#4ade80' }, likeLabelStyle]}>
          <Text className="text-[42px] font-bold tracking-[1.5px] uppercase" style={{ color: '#4ade80' }}>SAKLA</Text>
        </Animated.View>
        <Animated.View className="absolute top-[40%] right-10 z-0 border-[5px] rounded-xl px-4 py-2 rotate-[-25deg]" style={[{ borderColor: '#f87171' }, nopeLabelStyle]}>
          <Text className="text-[42px] font-bold tracking-[1.5px] uppercase" style={{ color: '#f87171' }}>SİL</Text>
        </Animated.View>

        {resolvedUri ? (
          <Animated.View
            key={assets[currentIndex]?.id}
            entering={FadeInRight.duration(200)}
            exiting={FadeOutLeft.duration(200)}
            style={{ alignItems: 'center', width: '100%' }}
          >
            <GestureDetector gesture={panGesture}>
              <Animated.View
                className="w-11/12 h-4/5 rounded-3xl overflow-hidden shadow-2xl"
                style={[{ backgroundColor: '#000' }, animatedStyle]}
              >
                <VideoView
                  key={resolvedUri}
                  style={{ width: '100%', height: '100%' }}
                  player={player}
                  allowsFullscreen
                  allowsPictureInPicture
                  nativeControls
                  resizeMode="contain"
                />
              </Animated.View>
            </GestureDetector>
          </Animated.View>
        ) : (
          <View className="w-11/12 h-3/5 items-center justify-center">
            <Text className="text-white">Video yüklenemedi</Text>
          </View>
        )}
      </View>
{/* SİL GEÇ GERİ BUTONLARI*/ }
<View className="absolute inset-x-0 bottom-0 items-center justify-center" style={{ paddingBottom: insets.bottom + 75 }}>
{isIOS18 ? (
            <View className="flex-row items-center justify-center gap-3">
            <TouchableOpacity accessibilityLabel="Geri Al" activeOpacity={0.85} onPress={undoLastDelete}>
              <View className="w-16 h-16 rounded-full" style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 }}>
                <View className="flex-1 items-center justify-center"><Text className="text-black text-3xl">↺</Text></View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity accessibilityLabel="Sil" activeOpacity={0.9} onPress={() => onSwipe('nope')}>
              <View className="w-20 h-20 rounded-full mx-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 }}>
                <View className="flex-1 items-center justify-center"><Text className="text-blue-400 text-4xl">❌</Text></View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity accessibilityLabel="Geç" activeOpacity={0.85} onPress={() => onSwipe('like')}>
              <View className="w-16 h-16 rounded-full" style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 }}>
                <View className="flex-1 items-center justify-center"><Text className="text-pink-500 text-3xl">➜</Text></View>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <GlassContainer spacing={12} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}> 
          <TouchableOpacity accessibilityLabel="Geri Al" activeOpacity={0.85} onPress={undoLastDelete}>
            <GlassView style={styles.glassSmall} isInteractive>
              <View className="flex-1 items-center justify-center">
                <Text className="text-black text-3xl">↺</Text>
              </View>
            </GlassView>
          </TouchableOpacity>
  
          <TouchableOpacity accessibilityLabel="Sil" activeOpacity={0.9} onPress={deleteCurrentVideo}>
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
        )}
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