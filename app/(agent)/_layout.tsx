// app/(agent)/_layout.tsx
// Booking Agent mode: the agent's own tabs. No band screens or band data.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '../../lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IconName, focusedName: IconName) {
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? focusedName : name} size={size} color={color} />;
  }
  return TabIcon;
}

export default function AgentLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.interactive,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: { fontFamily: fonts.bodySemibold, fontSize: 11, lineHeight: 14 },
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.orange,
          borderTopWidth: 2,
          height: 68 + insets.bottom,
          paddingTop: 4,
          paddingBottom: insets.bottom + 6,
        },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Shows', tabBarIcon: tabIcon('musical-notes-outline', 'musical-notes') }} />
      <Tabs.Screen name="bands" options={{ title: 'Bands', tabBarIcon: tabIcon('people-outline', 'people') }} />
      <Tabs.Screen name="venues" options={{ title: 'Venues', tabBarIcon: tabIcon('business-outline', 'business') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: tabIcon('person-outline', 'person') }} />
    </Tabs>
  );
}
