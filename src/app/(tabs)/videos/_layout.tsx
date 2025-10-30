import { Stack } from "expo-router";

export default function VideosStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Videos" }} />
      <Stack.Screen name="[albumId]" options={{ title: "Album" }} />
      <Stack.Screen name="start/[albumId]" options={{ title: "Start" }} />
    </Stack>
  );
}



