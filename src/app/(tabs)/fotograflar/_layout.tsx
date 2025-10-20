import { Stack } from "expo-router";

export default function FotograflarStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Fotoğraflar" }} />
      <Stack.Screen name="[albumId]" options={{ title: "Albüm" }} />
      <Stack.Screen name="start/[albumId]" options={{ title: "Başla", presentation: "card" }} />
    </Stack>
  );
}



