import type { ReactElement } from 'react';
import { Stack } from 'expo-router';

export default function RootLayout(): ReactElement {
  return <Stack screenOptions={{ headerShown: false }} />;
}
