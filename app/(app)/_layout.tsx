import { Tabs } from 'expo-router';

const COLORS = {
  background: '#0E1628',
  surface: '#1A2540',
  accent: '#E8602A',
  text: '#F5EDD9',
  textMuted: '#8A96B5',
};

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.surface },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="shows" options={{ title: 'Shows' }} />
    </Tabs>
  );
}
