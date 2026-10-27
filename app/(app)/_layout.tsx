import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../contexts/AuthContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { colors, fonts } from '../../lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IconName, focusedName: IconName) {
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? focusedName : name} size={size} color={color} />;
  }
  return TabIcon;
}

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  // Admin tools (More) are for band admins and superadmin only; members never see the tab.
  const isAdmin = profile?.role === 'band_admin' || profile?.role === 'superadmin';
  // Show-day reminders: register this device and open the day sheet on tap.
  usePushNotifications();
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
          // Explicit height so the Inter labels never clip, on top of the home-indicator inset.
          height: 68 + insets.bottom,
          paddingTop: 4,
          paddingBottom: insets.bottom + 6,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Shows', tabBarIcon: tabIcon('musical-notes-outline', 'musical-notes') }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: 'Calendar', tabBarIcon: tabIcon('calendar-outline', 'calendar') }}
      />
      <Tabs.Screen name="pay" options={{ title: 'Pay', tabBarIcon: tabIcon('cash-outline', 'cash') }} />
      <Tabs.Screen
        name="daysheet"
        options={{ title: 'Day Sheet', tabBarIcon: tabIcon('time-outline', 'time') }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: 'Assistant',
          href: isAdmin ? undefined : null,
          tabBarIcon: tabIcon('sparkles-outline', 'sparkles'),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          href: isAdmin ? undefined : null,
          tabBarIcon: tabIcon('grid-outline', 'grid'),
        }}
      />
      {/* Band roster + account: opened from the header button, not a tab. */}
      <Tabs.Screen name="band" options={{ href: null, title: 'Band' }} />
    </Tabs>
  );
}
