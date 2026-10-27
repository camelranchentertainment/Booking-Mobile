// components/assistant/ApprovalCard.tsx
// The assistant's proposed changes. Nothing is written until Confirm.
import { StyleSheet, Text, View } from 'react-native';

import type { StagedItem } from '../../lib/assistant';
import { colors, radius, space, type } from '../../lib/theme';
import { RetroButton } from '../retro';

interface Props {
  items: StagedItem[];
  errors: string[];
  overflow: number;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ApprovalCard({ items, errors, overflow, busy, onConfirm, onCancel }: Props) {
  return (
    <View style={styles.card} accessibilityLabel={`Approval needed for ${items.length} item${items.length === 1 ? '' : 's'}`}>
      <Text style={styles.eyebrow}>
        READY TO SAVE · {items.length} ITEM{items.length === 1 ? '' : 'S'}
      </Text>
      <Text style={styles.note}>Nothing is saved until you tap Confirm.</Text>

      {items.map((item) => (
        <View key={item.staged_action_id} style={styles.item}>
          <Text style={styles.summary}>{item.summary || item.kind.replace(/_/g, ' ')}</Text>
          {item.caution ? <Text style={styles.caution}>⚠ {item.caution}</Text> : null}
          {Array.isArray(item.conflicts) && item.conflicts.length > 0 ? (
            <Text style={styles.caution}>⚠ Another show is already on this date.</Text>
          ) : null}
        </View>
      ))}

      {errors.map((e) => (
        <Text key={e} style={styles.error}>
          Couldn&apos;t stage: {e}
        </Text>
      ))}
      {overflow > 0 ? (
        <Text style={styles.caution}>+{overflow} more not staged yet. Say &quot;continue&quot; for the next batch.</Text>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.flex}>
          <RetroButton label="Cancel" variant="outline" onPress={onCancel} disabled={busy} />
        </View>
        <View style={styles.flex}>
          <RetroButton
            label={`Confirm (${items.length})`}
            onPress={onConfirm}
            busy={busy}
            disabled={items.length === 0}
            accessibilityHint="Saves every item listed on this card"
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
  note: { ...type.sm, color: colors.textMuted },
  item: { paddingVertical: space.xs, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, gap: space.xxs },
  summary: { ...type.base, color: colors.cream },
  caution: { ...type.sm, color: colors.mustard },
  error: { ...type.sm, color: colors.danger },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  flex: { flex: 1 },
});
