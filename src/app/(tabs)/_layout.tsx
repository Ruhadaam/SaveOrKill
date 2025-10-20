import { NativeTabs, Label, Icon } from "expo-router/unstable-native-tabs";

export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="fotograflar">
        <Icon sf="photo.fill" />
        <Label>Fotoğraflar</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="videolar">
        <Icon sf="video.fill" />
        <Label>Videolar</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}


