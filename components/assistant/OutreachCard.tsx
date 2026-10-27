// components/assistant/OutreachCard.tsx
// Review an outreach email before it goes out: pick venues, edit the draft, send.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { venueKey, type AssistantAction, type OutreachVenue } from '../../lib/assistant';
import { colors, radius, space, touchTarget, type } from '../../lib/theme';
import { RetroButton } from '../retro';

type OutreachAction = Extract<AssistantAction, { type: 'tour_outreach' | 'city_search' }>;

interface Props {
  action: OutreachAction;
  actName: string | null;
  busy: boolean;
  onSend: (selected: OutreachVenue[], subject: string, body: string) => void;
  onCancel: () => void;
}

function initialDraft(action: OutreachAction, actName: string | null): { subject: string; body: string } {
  if (action.type === 'tour_outreach') return action.draft;
  const name = actName ?? 'our band';
  return {
    subject: `Booking inquiry — ${name}`,
    body: `Hi {contact_name},\n\nWe're reaching out about booking ${name} at {venue_name}.\n\nThanks,`,
  };
}

export function OutreachCard({ action, actName, busy, onSend, onCancel }: Props) {
  const start = initialDraft(action, actName);
  const [subject, setSubject] = useState(start.subject);
  const [body, setBody] = useState(start.body);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(action.venues.map(venueKey)));

  const toggle = (v: OutreachVenue) =>
    setChosen((prev) => {
      const next = new Set(prev);
      const k = venueKey(v);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const selected = action.venues.filter((v) => chosen.has(venueKey(v)));
  const withEmail = selected.filter((v) => !!v.email).length;
  const canSend = selected.length > 0 && subject.trim() !== '' && body.trim() !== '' && !busy;
  const title =
    action.type === 'tour_outreach'
      ? `${action.stage === 'follow_up' ? 'FOLLOW-UP' : 'OUTREACH'} · ${action.tourName.toUpperCase()}`
      : `VENUES IN ${action.city.toUpperCase()}, ${action.state.toUpperCase()}`;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{title}</Text>
      {action.type === 'tour_outreach' ? (
        <Text style={[styles.badge, { color: action.draftSource === 'agreed' ? colors.statusConfirmed : colors.mustard }]}>
          {action.draftSource === 'agreed' ? 'Email you approved in chat' : 'New draft — read it before sending'}
        </Text>
      ) : null}

      <Text style={styles.fieldLabel}>Send to ({selected.length} of {action.venues.length})</Text>
      {action.venues.map((v) => {
        const on = chosen.has(venueKey(v));
        return (
          <Pressable
            key={venueKey(v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${v.name}${v.email ? '' : ', no email on file'}`}
            onPress={() => toggle(v)}
            style={styles.venueRow}>
            <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.orange : colors.textMuted} />
            <View style={styles.flex}>
              <Text style={styles.venueName}>{v.name}</Text>
              <Text style={styles.venueMeta}>
                {[v.city, v.state].filter(Boolean).join(', ')}
                {v.email ? ` · ${v.email}` : ' · no email on file'}
              </Text>
            </View>
          </Pressable>
        );
      })}

      <Text style={styles.fieldLabel}>Subject</Text>
      <TextInput style={styles.input} value={subject} onChangeText={setSubject} accessibilityLabel="Email subject" />
      <Text style={styles.fieldLabel}>Message</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={body}
        onChangeText={setBody}
        multiline
        accessibilityLabel="Email message"
      />
      <Text style={styles.note}>
        {'{venue_name}'} and {'{contact_name}'} are filled in per venue. Sends from your connected Gmail
        {withEmail < selected.length ? `; ${selected.length - withEmail} without an email will be skipped` : ''}.
      </Text>

      <View style={styles.actions}>
        <View style={styles.flex}>
          <RetroButton label="Cancel" variant="outline" onPress={onCancel} disabled={busy} />
        </View>
        <View style={styles.flex}>
          <RetroButton
            label={`Send (${withEmail})`}
            onPress={() => onSend(selected, subject.trim(), body)}
            busy={busy}
            disabled={!canSend || withEmail === 0}
            accessibilityHint="Emails every checked venue that has an address"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.orange,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  eyebrow: { ...type.eyebrow, color: colors.orange },
  badge: { ...type.xs },
  fieldLabel: { ...type.xs, color: colors.textMuted, marginTop: space.sm, textTransform: 'uppercase' },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touchTarget },
  venueName: { ...type.md, color: colors.cream },
  venueMeta: { ...type.sm, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundDeep,
    color: colors.cream,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 44,
    ...type.base,
  },
  multiline: { minHeight: 160, textAlignVertical: 'top' },
  note: { ...type.sm, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  flex: { flex: 1 },
});
