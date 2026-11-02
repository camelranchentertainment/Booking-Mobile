// components/AgentContactLinks.tsx
// Tap-to-call, email, website and map buttons for an agent's band or venue row.
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { mapsUrl, openSafely, telUrl, webUrl } from '../lib/links';
import { colors, radius, space, touchTarget, type } from '../lib/theme';

interface Props {
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  mapQuery?: string | null;
}

function LinkButton({ icon, label, url }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => void openSafely(url)}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Ionicons name={icon} size={16} color={colors.interactive} aria-hidden />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

export function AgentContactLinks({ phone, email, website, mapQuery }: Props) {
  if (!phone && !email && !website && !mapQuery) return null;
  return (
    <View style={styles.row}>
      {phone ? <LinkButton icon="call-outline" label="Call" url={telUrl(phone)} /> : null}
      {email ? <LinkButton icon="mail-outline" label="Email" url={`mailto:${email}`} /> : null}
      {website ? <LinkButton icon="globe-outline" label="Website" url={webUrl(website)} /> : null}
      {mapQuery ? <LinkButton icon="map-outline" label="Map" url={mapsUrl(mapQuery)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: touchTarget,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.75 },
  label: { ...type.sm, color: colors.cream },
});
