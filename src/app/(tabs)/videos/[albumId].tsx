import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { View, FlatList, ActivityIndicator, Text, Image, Dimensions, Platform } from "react-native";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import { Link, useLocalSearchParams, useNavigation } from "expo-router";
import { getThumbnailAsync } from "expo-video-thumbnails";

const gutter = 2;
const numColumns = 3;
const size = Math.floor(Dimensions.get("window").width / numColumns) - gutter * 2;

export default function AlbumVideos() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<MediaLibrary.PermissionStatus | null>(null);
  const [hasFailures, setHasFailures] = useState<boolean>(false);
  const failedReportedRef = useRef<Set<string>>(new Set());

  const navigation = useNavigation();

  const loadAssets = useCallback(async () => {
    const { status } = await MediaLibrary.getPermissionsAsync();
    if (status !== "granted") {
      const res = await (MediaLibrary as any).requestPermissionsAsync(
        Platform.OS === "ios" ? { accessPrivileges: "all" } : undefined
      );
      setPermissionStatus(res.status);
      if (res.status !== "granted") return;
    } else {
      setPermissionStatus(status);
    }
    setLoading(true);
    try {
      const page = await MediaLibrary.getAssetsAsync({
        album: String(albumId),
        mediaType: [MediaLibrary.MediaType.video],
        first: 1000,
        sortBy: MediaLibrary.SortBy.creationTime,
      });
      setAssets(page.assets);
    } finally {
      setLoading(false);
    }
  }, [albumId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);


  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Link href={`/(tabs)/videos/start/${albumId}`} asChild>
          <Text className="text-blue-600 px-3 py-1">Start</Text>
        </Link>
      ),
    });
  }, [navigation, albumId]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (!assets.length) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text>No videos found in this album.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={assets}
      keyExtractor={(a) => a.id}
      numColumns={numColumns}
      contentContainerStyle={{ padding: gutter }}
      ListHeaderComponent={
        hasFailures ? (
          <View className="bg-yellow-50 px-4 py-3 m-2 rounded-lg border border-yellow-200">
            <Text className="text-yellow-900 text-center font-bold text-sm">
              Some videos could not be displayed because they are stored in iCloud or are restricted by iOS permissions. You can make them available offline or check your app permissions to resolve this.
            </Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <VideoThumb
          asset={item}
          size={size}
          onResolve={(ok) => {
            if (!ok && !failedReportedRef.current.has(item.id)) {
              failedReportedRef.current.add(item.id);
              setHasFailures(true);
            }
          }}
        />
      )}
    />
  );
}

function VideoThumb({ asset, size, onResolve }: { asset: MediaLibrary.Asset; size: number; onResolve?: (ok: boolean) => void }) {
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [failed, setFailed] = useState<boolean>(false);
  const reportedRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        let assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
        if (!assetInfo.localUri && Platform.OS === "ios") {
          assetInfo = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: true });
        }

        let sourceUri = assetInfo.localUri || asset.uri;
        if (!sourceUri) {
          throw new Error("No source URI available for asset.");
        }

        // Remove hash fragment if present
        if (sourceUri.includes("#")) {
          sourceUri = sourceUri.split("#")[0];
        }

        let workingUri = sourceUri;

        // iOS sandbox korumasını aşmak için cache’e kopyala
        if (Platform.OS === "ios" && sourceUri.startsWith("file:///var/mobile/Media")) {
          const fileExt = asset.filename?.split(".").pop()?.toLowerCase() || "mp4";
          const tempPath = `${FileSystem.cacheDirectory}${asset.id}.${fileExt}`;
          try {
            await FileSystem.copyAsync({ from: sourceUri, to: tempPath });
          } catch (copyErr) {
          }
        }

        try {
          const { uri: thumbUri } = await getThumbnailAsync(workingUri, {
            time: 0,
            quality: 0.6,
          });

          if (isMounted) {
            setThumbUri(thumbUri);
            setFailed(false);
            if (!reportedRef.current) {
              onResolve?.(true);
              reportedRef.current = true;
            }
          }
          return; // Success
        } catch (directError: any) {
        }

        // Fallback: If direct generation fails, copy the file using the asset's original URI (ph://)
        // and then generate a thumbnail from the copy.
        try {
          // Use asset.uri (the ph:// URI) for copying, as FileSystem knows how to handle it.
          const fileExt = asset.filename?.split(".").pop()?.toLowerCase() || "mov";
          const fileName = `thumb-${asset.id}-${Date.now()}.${fileExt}`;
          const tempPath = `${FileSystem.cacheDirectory}${fileName}`;

          await FileSystem.copyAsync({ from: asset.uri, to: tempPath });

          const fileUri = tempPath.startsWith("file://") ? tempPath : `file://${tempPath}`;

          const { uri: thumbUri } = await getThumbnailAsync(fileUri, {
            time: 0,
            quality: 0.6,
          });

          if (isMounted) {
            setThumbUri(thumbUri);
            setFailed(false);
            if (!reportedRef.current) {
              onResolve?.(true);
              reportedRef.current = true;
            }
          }
        } catch (copyError) {
          if (isMounted) {
            setFailed(true);
            if (!reportedRef.current) {
              onResolve?.(false);
              reportedRef.current = true;
            }
          }
        }
      } catch (e) {
        if (isMounted) {
          setFailed(true);
          if (!reportedRef.current) {
            onResolve?.(false);
            reportedRef.current = true;
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [asset.id, asset.uri]);

  // format duration mm:ss
  const totalSeconds = Math.max(0, Math.floor(asset.duration || 0));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(1, "0");
  const seconds = (totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  // Show placeholder if loading, failed, or no thumbnail
  if (loading || failed || !thumbUri) {
    return (
      <View style={{ width: size, height: size, margin: gutter }} className="relative">
        {/* Placeholder background */}
        <View className="w-full h-full bg-gray-200 items-center justify-center rounded">
          {/* Video icon or error icon */}
          <View className="w-10 h-10 rounded-full bg-black/30 items-center justify-center">
            <Text className="text-gray-500 text-xl">
              {failed ? "⚠" : "▶"}
            </Text>
          </View>
          {/* Status text */}
          <Text className="text-gray-400 text-[10px] mt-2 text-center px-1">
            {loading ? "Loading..." : "Thumbnail unavailable"}
          </Text>
        </View>

        {/* Duration badge - still show if available */}
        {asset.duration && asset.duration > 0 && (
          <View className="absolute right-1.5 bottom-1.5 bg-black/60 px-1.5 py-0.5 rounded">
            <Text className="text-white text-[10px]">{minutes}:{seconds}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, margin: gutter, position: "relative" }}>
      <Image source={{ uri: thumbUri }} style={{ width: "100%", height: "100%" }} />

      {/* Play overlay */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: "rgba(0,0,0,0.5)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, marginLeft: 2 }}>▶</Text>
        </View>
      </View>

      {/* Duration badge */}
      <View
        style={{
          position: "absolute",
          right: 6,
          bottom: 6,
          backgroundColor: "rgba(0,0,0,0.6)",
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 6,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 10 }}>{minutes}:{seconds}</Text>
      </View>
    </View>
  );
}
