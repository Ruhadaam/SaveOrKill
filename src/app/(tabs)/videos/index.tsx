import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator, Platform, TouchableOpacity } from "react-native";
import * as MediaLibrary from "expo-media-library";
import { Link } from "expo-router";
import { GlassView } from 'expo-glass-effect';

const getAlbumEmoji = (albumTitle: string) => {
  const lowerCaseTitle = albumTitle.toLowerCase();
  if (lowerCaseTitle.includes("whatsapp")) return "💬";
  if (lowerCaseTitle.includes("camera")) return "📸";
  if (lowerCaseTitle.includes("screenshots")) return "🖼️";
  if (lowerCaseTitle.includes("downloads")) return "📥";
  if (lowerCaseTitle.includes("favorites")) return "⭐";
  if (lowerCaseTitle.includes("selfies")) return "🤳";
  if (lowerCaseTitle.includes("videos")) return "🎥";
  if (lowerCaseTitle.includes("panoramas")) return "🏞️";
  if (lowerCaseTitle.includes("live photos")) return "📹";
  if (lowerCaseTitle.includes("bursts")) return "💥";
  if (lowerCaseTitle.includes("instagram")) return "📸";
  if (lowerCaseTitle.includes("snapchat")) return "👻";
  if (lowerCaseTitle.includes("facebook")) return "👍";
  if (lowerCaseTitle.includes("messenger")) return "💬";
  if (lowerCaseTitle.includes("twitter")) return "🐦";
  if (lowerCaseTitle.includes("tiktok")) return "🎵";
  return "📁";
};

export default function VideosIndex() {
  const [permissionStatus, setPermissionStatus] = useState<MediaLibrary.PermissionStatus | null>(null);
  const [albums, setAlbums] = useState<{ album: MediaLibrary.Album; count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensurePermission() {
    try {
      setError(null);
      const { status } = await MediaLibrary.getPermissionsAsync();
      if (status !== "granted") {
        const res = await (MediaLibrary as any).requestPermissionsAsync(
          Platform.OS === "ios" ? { accessPrivileges: "all" } : undefined
        );
        setPermissionStatus(res.status);
        return res.status === "granted";
      }
      setPermissionStatus(status);
      return true;
    } catch (e) {
      setError("An error occurred while getting permission");
      return false;
    }
  }

  const loadVideoAlbums = useCallback(async () => {
    setLoading(true);
    try {
      const result = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
      const withCounts = await Promise.all(
        result.map(async (album) => {
          const assets = await MediaLibrary.getAssetsAsync({ album, mediaType: MediaLibrary.MediaType.video, first: 1 });
          return { album, count: assets.totalCount };
        })
      );
      setAlbums(withCounts.filter((x) => x.count > 0));
    } catch (e) {
      setError("An error occurred while loading albums");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await ensurePermission();
      if (ok) await loadVideoAlbums();
    })();
  }, []);

  if (permissionStatus !== "granted") {
    return (
      <View className="flex-1 items-center justify-center gap-3 p-4">
        <Text className="text-lg text-center">Gallery access is required.</Text>
        <TouchableOpacity
          onPress={async () => {
            const ok = await ensurePermission();
            if (ok) await loadVideoAlbums();
            console.log("Permission granted to gallery");
          }}
          className="px-4 py-2 rounded-md bg-gray-900"
        >
          <Text className="text-gray-50">Allow Gallery Access</Text>
        </TouchableOpacity>
        {error ? <Text className="text-red-600 text-center">{error}</Text> : null}
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <FlatList
        data={albums}
        keyExtractor={(a) => `${a.album.id}`}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => {
          const majorVersion = Platform.OS === 'ios' ? parseInt(String(Platform.Version), 10) : 0;
          const isIOS18 = majorVersion >= 18;

          const content = (
            <View className="p-4">
              <Text className="text-base font-semibold">{getAlbumEmoji(item.album.title)} {item.album.title}</Text>
              <Text className="text-xs text-gray-600 mt-1">{item.count} video</Text>
            </View>
          );

          const wrapped = isIOS18 ? (
            <View style={{ borderRadius: 12, overflow: "hidden", backgroundColor: 'rgba(255, 255, 255, 0.7)' }}>
              {content}
            </View>
          ) : (
            <GlassView style={{ borderRadius: 12, overflow: "hidden" }}>
              {content}
            </GlassView>
          );

          return (
            <Link href={`/(tabs)/videos/${item.album.id}`} asChild>
              <TouchableOpacity activeOpacity={0.7}>{wrapped}</TouchableOpacity>
            </Link>
          );
        }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center p-8">
            <Text>No albums containing videos were found.</Text>
          </View>
        }
      />
    </View>
  );
}



