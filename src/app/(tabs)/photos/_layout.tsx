import { Stack } from "expo-router";

export default function PhotosStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Photos" }} />
      <Stack.Screen name="[albumId]" options={{ title: "Album" }} />
      <Stack.Screen name="start/[albumId]" options={{ title: "Start", presentation: "card" }} />
    </Stack>
  );
}



