/**
 * Edit one row of a set list: a song's key and notes for this show ("capo 2",
 * "slow intro"), or a break/note's text. Remove takes the row off this list
 * only; the song stays in the library.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { LIMITS, type BuilderItem, type Song } from '../../lib/adminSetLists';
import { RetroButton } from '../retro';
import { Field, Sheet, sheetStyles as s } from './Sheet';

interface Props {
  item: BuilderItem | null;
  song: Song | null;
  onClose: () => void;
  onSave: (next: BuilderItem) => void;
  onRemove: (key: string) => void;
}

export function ItemSheet({ item, song, onClose, onSave, onRemove }: Props) {
  return (
    <Sheet
      visible={item !== null}
      title={item?.type === 'song' ? 'SONG ON THIS SET' : item?.type === 'break' ? 'BREAK' : 'NOTE'}
      onClose={onClose}>
      {/* Keyed so each opened row starts from its own values. */}
      {item ? <ItemForm key={item.key} item={item} song={song} onClose={onClose} onSave={onSave} onRemove={onRemove} /> : null}
    </Sheet>
  );
}

function ItemForm({ item, song, onClose, onSave, onRemove }: Omit<Props, 'item'> & { item: BuilderItem }) {
  const [label, setLabel] = useState(item.label ?? '');
  const [keyOverride, setKeyOverride] = useState(item.keyOverride ?? '');
  const [notes, setNotes] = useState(item.notes ?? '');
  const isSong = item.type === 'song';

  return (
    <>
      {isSong ? (
        <>
          <Text style={s.hint}>
            {song ? `${song.title}${song.artist ? ` · ${song.artist}` : ''}` : 'This song was removed from your library.'}
          </Text>
          <Field
            label="Key for this show"
            value={keyOverride}
            onChange={setKeyOverride}
            placeholder={song?.key ? `Usual key: ${song.key}` : 'e.g. G, F#m'}
            autoCapitalize="none"
            maxLength={LIMITS.key}
          />
        </>
      ) : (
        <Field
          label={item.type === 'break' ? 'Break label' : 'Note'}
          value={label}
          onChange={setLabel}
          placeholder={item.type === 'break' ? 'Break' : 'e.g. Encore if the crowd is up'}
          maxLength={LIMITS.label}
        />
      )}
      <Field
        label={isSong ? 'Notes for the band' : 'Extra notes'}
        value={notes}
        onChange={setNotes}
        placeholder={isSong ? 'e.g. capo 2, segue into next' : 'Optional'}
        maxLength={LIMITS.itemNotes}
        multiline
      />
      <View style={s.actions}>
        <View style={s.flex}>
          <RetroButton label="Cancel" variant="outline" onPress={onClose} />
        </View>
        <View style={s.flex}>
          <RetroButton
            label="Done"
            onPress={() => onSave({ ...item, label: isSong ? item.label : label, keyOverride: isSong ? keyOverride : null, notes })}
          />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={isSong ? 'Takes the song off this set list. It stays in your library.' : undefined}
        onPress={() => onRemove(item.key)}
        style={({ pressed }) => [s.secondary, pressed && s.pressed]}>
        <Text style={s.dangerText}>Remove from this set list</Text>
      </Pressable>
    </>
  );
}
