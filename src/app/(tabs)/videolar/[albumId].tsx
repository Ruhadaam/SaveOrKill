import React, { useEffect, useRef, useState } from "react";
import { View, FlatList, ActivityIndicator, Text, Image, Dimensions, Platform } from "react-native";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams } from "expo-router";
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

  useEffect(() => {
    (async () => {
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
          mediaType: [MediaLibrary.MediaType.video], // array olarak dene
          first: 1000, // sayfalama
          sortBy: MediaLibrary.SortBy.creationTime,
        });
        setAssets(page.assets);
      } finally {
        setLoading(false);
      }
    })();
  }, [albumId]);

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
        <Text>Bu albümde video bulunamadı.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={assets}
        keyExtractor={(a) => a.id}
        key={`grid-${numColumns}`}
        numColumns={numColumns}
        contentContainerStyle={{ padding: gutter, paddingBottom: hasFailures ? 48 : gutter }}
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

      {hasFailures ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#fef3c7",
            borderTopWidth: 1,
            borderColor: "#fde68a",
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: "#92400e", fontSize: 12 }}>
            Bazı videolara erişilemiyor. iCloud veya uygulama kısıtlaması olabilir.
          </Text>
        </View>
      ) : null}
    </View>
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
          // iCloud'daki öğeler için yerel kopyayı indirmeyi dene
          assetInfo = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: true });
        }
        const candidateUri = assetInfo.localUri || asset.uri; // prefer a file:// URI when available

        const { uri } = await getThumbnailAsync(candidateUri, {
          time: 0,
          quality: 0.6,
        });

        if (isMounted) {
          setThumbUri(uri);
          setFailed(false);
          if (!reportedRef.current) {
            onResolve && onResolve(true);
            reportedRef.current = true;
          }
        }
      } catch (e) {
        console.error("Error generating thumbnail:", e);
        if (isMounted) {
          setFailed(true);
          if (!reportedRef.current) {
            onResolve && onResolve(false);
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

  if (loading) return null; // izin yoksa/henüz hazır değilse bu öğeyi atla

  // format duration mm:ss
  const totalSeconds = Math.max(0, Math.floor(asset.duration || 0));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(1, "0");
  const seconds = (totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  if (failed || !thumbUri) return null; // gösterilemiyorsa hiç render etme

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
