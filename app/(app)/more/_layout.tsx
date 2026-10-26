// app/(app)/more/_layout.tsx
// The admin-only "More" tab: a stack so screens like Venues → a venue can be
// pushed and swiped back. Each screen draws its own retro header.
import { Stack } from 'expo-router';

import { colors } from '../../../lib/theme';

export default function MoreLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
