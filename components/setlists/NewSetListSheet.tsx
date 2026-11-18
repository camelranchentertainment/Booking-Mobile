/**
 * Start a set list for a show (or a reusable template), blank or copied from
 * an earlier list — most bands play mostly the same set, so copying last
 * week's and tweaking it is the usual path.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createSetList, LIMITS, type SetListHeader, type SetListShow } from '../../lib/adminSetLists';
import { parseLocalDate } from '../../lib/dates';
import { colors, space, touchTarget, type } from '../../lib/theme';
import { RetroButton } from '../retro';
import { Field, Sheet, sheetStyles as s } from './Sheet';

export type NewTarget = { kind: 'show'; show: SetListShow } | { kind: 'template' };

interface Props {
  actId: string;
  target: NewTarget | null;
  /** Existing lists to copy from, newest first. */
  lists: readonly SetListHeader[];
  /** Labels lists that belong to a show ("Venue · Nov 21"). */
  showLabel: (bookingId: string) => string | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}

/** How many earlier lists to offer as starting points. */
const COPY_CHOICES = 8;

/** "Nov 21" for names and hints; "date TBD" when unknown. */
export function shortDate(dateStr: string | null | undefined): string {
  const d = parseLocalDate(dateStr);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'date TBD';
}

function defaultName(target: NewTarget): string {
  if (target.kind === 'template') return 'Standard set';
  const venue = target.show.venueName?.trim() || 'Show';
  return `${venue} · ${shortDate(target.show.showDate)}`.slice(0, LIMITS.name);
}

export function NewSetListSheet(props: Props) {
  const { target, onClose } = props;
  return (
    <Sheet visible={target !== null} title={target?.kind === 'template' ? 'NEW TEMPLATE' : 'NEW SET LIST'} onClose={onClose}>
      {target ? <NewForm key={target.kind === 'show' ? target.show.id : 'template'} {...props} target={target} /> : null}
    </Sheet>
  );
}

function NewForm({ actId, target, lists, showLabel, onClose, onCreated }: Props & { target: NewTarget }) {
  const [name, setName] = useState(() => defaultName(target));
  const [copyFrom, setCopyFrom] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Templates first (they're made for copying), then recent show lists.
  const choices = [...lists.filter((l) => l.isTemplate), ...lists.filter((l) => !l.isTemplate)].slice(0, COPY_CHOICES);
  const trimmed = name.trim();
  const problem = !trimmed ? 'Give the set list a name.' : trimmed.length > LIMITS.name ? 'That name is too long.' : null;

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const id = await createSetList(actId, trimmed, target.kind === 'show' ? target.show.id : null, copyFrom);
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't start the set list.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {target.kind === 'show' ? (
        <Text style={s.hint}>
          For {target.show.venueName ?? 'this show'} on {shortDate(target.show.showDate)}.
        </Text>
      ) : (
        <Text style={s.hint}>A template is a set you reuse. Copy it onto a show, then push that show&apos;s list to the band.</Text>
      )}
      <Field label="Name" value={name} onChange={setName} maxLength={LIMITS.name} />

      <Text style={s.label}>Start from</Text>
      <View accessibilityRole="radiogroup">
        <Choice label="Blank list" selected={copyFrom === null} onPress={() => setCopyFrom(null)} />
        {choices.map((l) => {
          const where = l.isTemplate ? 'Template' : (l.bookingId ? showLabel(l.bookingId) : null) ?? 'Past show';
          return (
            <Choice key={l.id} label={`Copy “${l.name}”`} detail={where} selected={copyFrom === l.id} onPress={() => setCopyFrom(l.id)} />
          );
        })}
      </View>

      {problem && name !== '' ? <Text style={s.error}>{problem}</Text> : null}
      {error ? <Text style={s.error} accessibilityRole="alert">{error}</Text> : null}
      <View style={s.actions}>
        <View style={s.flex}>
          <RetroButton label="Cancel" variant="outline" onPress={onClose} disabled={saving} />
        </View>
        <View style={s.flex}>
          <RetroButton label="Create" onPress={() => void create()} busy={saving} disabled={!!problem} />
        </View>
      </View>
    </>
  );
}

function Choice({ label, detail, selected, onPress }: { label: string; detail?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed && s.pressed]}>
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.orange : colors.textMuted} />
      <View style={s.flex}>
        <Text style={styles.choiceText} numberOfLines={1}>{label}</Text>
        {detail ? <Text style={s.hint} numberOfLines={1}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choice: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touchTarget, paddingVertical: space.xs },
  choiceText: { ...type.md, color: colors.cream },
});
