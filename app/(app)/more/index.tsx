// app/(app)/more/index.tsx
// Band-admin hub for everything beyond shows: what's in the app today, plus
// links to the website for the parts that are better on a big screen.
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountButton } from '../../../components/AccountButton';
import { RetroStripes, ScreenHeader } from '../../../components/retro';
import { openSafely } from '../../../lib/links';
import { READABLE_MAX_WIDTH } from '../../../lib/layout';
import { colors, radius, space, touchTarget, type } from '../../../lib/theme';
import { API_BASE } from '../../../lib/memberShows';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface Item {
  icon: IconName;
  title: string;
  detail: string;
  /** In-app screen, or a website path opened in the browser. */
  to: { screen: Href } | { web: string };
}

const IN_APP: Item[] = [
  { icon: 'business-outline', title: 'Venues', detail: 'Search your venues, call or email the venue contact, keep notes', to: { screen: '/more/venues' } },
  { icon: 'cash-outline', title: 'Money', detail: "This year's earned, upcoming, expenses and who still owes you", to: { screen: '/more/money' } },
  { icon: 'people-outline', title: 'Roster', detail: 'Band and crew: add people, roles, phone numbers and usual pay', to: { screen: '/more/roster' } },
];

const ON_WEBSITE: Item[] = [
  { icon: 'map-outline', title: 'Tours', detail: 'Plan tours and target venues', to: { web: '/tours' } },
  { icon: 'mail-outline', title: 'Email', detail: 'Outreach, follow-ups and your inbox', to: { web: '/email' } },
  { icon: 'receipt-outline', title: 'Financials', detail: 'Add expenses, mark shows paid, export for taxes', to: { web: '/financials' } },
  { icon: 'key-outline', title: 'Members', detail: 'Logins and invites for your band', to: { web: '/band/members' } },
  { icon: 'stats-chart-outline', title: 'Analytics', detail: 'How your booking is going', to: { web: '/analytics' } },
  { icon: 'settings-outline', title: 'Settings', detail: 'Account, billing and calendar sync', to: { web: '/settings' } },
];

function Row({ item, onPress }: { item: Item; onPress: () => void }) {
  const external = 'web' in item.to;
  return (
    <Pressable
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={item.title}
      accessibilityHint={external ? `Opens ${item.title} on camelranchbooking.com` : item.detail}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.iconWrap} aria-hidden>
        <Ionicons name={item.icon} size={22} color={colors.onInteractive} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.detail}>{item.detail}</Text>
      </View>
      <Ionicons name={external ? 'open-outline' : 'chevron-forward'} size={20} color={colors.textMuted} aria-hidden />
    </Pressable>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const open = (item: Item) => {
    if ('screen' in item.to) router.push(item.to.screen);
    else void openSafely(`${API_BASE}${item.to.web}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader title="More" subtitle="Band admin tools" right={<AccountButton />} />
        <RetroStripes height={4} gap={2} style={styles.stripes} />

        <Text style={styles.section}>IN THE APP</Text>
        <View style={styles.list}>
          {IN_APP.map((item) => <Row key={item.title} item={item} onPress={() => open(item)} />)}
        </View>

        <Text style={styles.section}>ON THE WEBSITE</Text>
        <Text style={styles.note}>These open camelranchbooking.com in your browser.</Text>
        <View style={styles.list}>
          {ON_WEBSITE.map((item) => <Row key={item.title} item={item} onPress={() => open(item)} />)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: READABLE_MAX_WIDTH, alignSelf: 'center', backgroundColor: colors.background },
  scroll: { paddingBottom: space['4xl'] },
  stripes: { marginBottom: space.lg },
  flex: { flex: 1 },
  section: { ...type.label, color: colors.orange, paddingHorizontal: space.xl, marginTop: space.lg, marginBottom: space.sm },
  note: { ...type.sm, color: colors.textMuted, paddingHorizontal: space.xl, marginBottom: space.sm },
  list: { paddingHorizontal: space.xl, gap: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    minHeight: touchTarget + 16,
  },
  pressed: { opacity: 0.8 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.lg, color: colors.cream },
  detail: { ...type.sm, color: colors.textMuted },
});
