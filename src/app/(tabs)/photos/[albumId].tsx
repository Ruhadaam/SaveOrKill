import React, { useEffect, useState, useCallback } from "react";
import { View, FlatList, Image, Dimensions, ActivityIndicator, Text } from "react-native";
import * as MediaLibrary from "expo-media-library";
import { Link, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { useLayoutEffect } from "react";

const gutter = 2;
const numColumns = 3;
const size = Math.floor(Dimensions.get("window").width / numColumns) - gutter * 2;

export default function AlbumPhotos() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<MediaLibrary.PermissionStatus | null>(null);
  const navigation = useNavigation();

  const loadAssets = useCallback(async () => {
    const { status } = await MediaLibrary.getPermissionsAsync();
    if (status !== "granted") {
      const res = await MediaLibrary.requestPermissionsAsync();
      setPermissionStatus(res.status);
      if (res.status !== "granted") return;
    } else {
      setPermissionStatus(status);
    }
    setLoading(true);
    try {
      const page = await MediaLibrary.getAssetsAsync({ album: String(albumId), mediaType: MediaLibrary.MediaType.photo, first: 2000, sortBy: MediaLibrary.SortBy.creationTime });
      setAssets(page.assets);
    } finally {
      setLoading(false);
    }
  }, [albumId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Reload when page comes into focus (only if we navigated from delete)
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        loadAssets();
      }, 500);
      return () => clearTimeout(timer);
    }, [loadAssets])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Link href={`/(tabs)/photos/start/${albumId}`} asChild>
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
        <Text>No photos found in this album.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={assets}
      keyExtractor={(a) => a.id}
      numColumns={numColumns}
      contentContainerStyle={{ padding: gutter }}
      renderItem={({ item }) => (
        <AssetThumb asset={item} size={size} />
      )}
    />
  );
}

function AssetThumb({ asset, size }: { asset: MediaLibrary.Asset; size: number }) {
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const info = await MediaLibrary.getAssetInfoAsync(asset.id);
        if (!isMounted) return;
        setUri(info.localUri || asset.uri);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [asset.id, asset.uri]);

  if (loading) {
    return (
      <View style={{ width: size, height: size, margin: gutter }}>
        <ActivityIndicator style={{ flex: 1 }} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: uri ?? undefined }}
      style={{ width: size, height: size, margin: gutter }}
    />
  );
}


