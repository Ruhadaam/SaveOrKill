import { Stack } from "expo-router";

export default function VideolarStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Videolar" }} />
      <Stack.Screen name="[albumId]" options={{ title: "Albüm" }} />
    </Stack>
  );
}



