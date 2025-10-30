import { NativeTabs, Label, Icon } from "expo-router/unstable-native-tabs";

export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="photos">
        <Icon sf="photo.fill" />
        <Label>Photos</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="videos">
        <Icon sf="video.fill" />
        <Label>Videos</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}


