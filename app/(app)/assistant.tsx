// app/(app)/assistant.tsx
// The booking assistant for band admins — the same assistant as the website's
// /band page, talking to the same API, sharing today's chat with the website.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountButton } from '../../components/AccountButton';
import { ApprovalCard } from '../../components/assistant/ApprovalCard';
import { OutreachCard } from '../../components/assistant/OutreachCard';
import { RetroStripes, ScreenHeader, StateMessage } from '../../components/retro';
import { useAuth } from '../../contexts/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import {
  askAssistant,
  clearTodaysChat,
  confirmStaged,
  describeConfirm,
  loadTodaysChat,
  saveTodaysChat,
  sendOutreach,
  todayKey,
  type AssistantAction,
  type ChatMessage,
  type OutreachVenue,
} from '../../lib/assistant';
import { fetchActName } from '../../lib/band';
import { READABLE_MAX_WIDTH } from '../../lib/layout';
import { colors, radius, space, touchTarget, type } from '../../lib/theme';

const SUGGESTIONS = [
  'What shows do I have this month?',
  'Add a show',
  'Who still owes us money?',
  'Follow up with venues that haven’t replied',
];

/** Longest message the composer accepts; long pastes go through the website's file upload. */
const MAX_INPUT = 4000;

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function AssistantScreen() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'band_admin' || profile?.role === 'superadmin';
  const actId = profile?.act_id ?? null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [action, setAction] = useState<AssistantAction | null>(null);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dayRef = useRef(todayKey());
  const scrollRef = useRef<ScrollView>(null);

  // Today's saved chat (shared with the website), loaded once per day.
  const [chatDay] = useState(() => todayKey());
  const chat = useAsyncData(
    `assistant:${isAdmin ? chatDay : 'none'}`,
    () => (isAdmin ? loadTodaysChat(chatDay) : Promise.resolve([] as ChatMessage[])),
    "We couldn't load today's chat. Check your connection and try again."
  );
  const actNameData = useAsyncData(
    `assistant-act:${actId ?? 'none'}`,
    () => (actId ? fetchActName(actId) : Promise.resolve(null)),
    "We couldn't load your band's name."
  );
  const actName = actNameData.data ?? null;
  const loaded = chat.data !== null;
  const loadError = chat.error;

  // Seed the editable thread from the saved chat once it arrives — adjusted
  // during render (no effect), the same pattern DaySheetModal uses.
  const [seeded, setSeeded] = useState(false);
  if (!seeded && chat.data) {
    setSeeded(true);
    setMessages(chat.data);
  }

  // Keep the newest message in view.
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages, action, thinking]);

  /** Appends assistant text and saves the whole chat. */
  const appendAndSave = (base: ChatMessage[], content: string) => {
    const next = [...base, { role: 'assistant' as const, content }];
    setMessages(next);
    void saveTodaysChat(next, dayRef.current);
    return next;
  };

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || thinking) return;
    // A new day starts a fresh chat, same as the website.
    const rolledOver = dayRef.current !== todayKey();
    if (rolledOver) dayRef.current = todayKey();
    const history = rolledOver ? [] : messages;
    const next = [...history, { role: 'user' as const, content: msg }];
    setMessages(next);
    setInput('');
    setAction(null);
    setError(null);
    setThinking(true);
    try {
      const res = await askAssistant(msg, history);
      appendAndSave(next, res.reply || 'Done.');
      setAction(res.action);
    } catch (err) {
      setMessages(history); // put the chat back the way it was; the text stays in the box
      setInput(msg);
      setError(errorText(err, 'The assistant could not answer. Try again.'));
    } finally {
      setThinking(false);
    }
  };

  const confirm = async () => {
    if (!action || action.type !== 'stage_items' || acting) return;
    setActing(true);
    setError(null);
    try {
      const results = await confirmStaged(action.staged);
      appendAndSave(messages, describeConfirm(action.staged, results));
      setAction(null);
    } catch (err) {
      setError(errorText(err, 'Saving failed. Nothing was changed.'));
    } finally {
      setActing(false);
    }
  };

  const sendEmails = async (selected: OutreachVenue[], subject: string, body: string) => {
    if (!action || (action.type !== 'tour_outreach' && action.type !== 'city_search') || acting || !actId) return;
    setActing(true);
    setError(null);
    try {
      const r = await sendOutreach({ actId, action, selected, subject, body });
      appendAndSave(
        messages,
        `Sent ${r.sent} email${r.sent === 1 ? '' : 's'}${r.noEmail ? `, ${r.noEmail} skipped (no email on file)` : ''}${
          r.errors ? `, ${r.errors} failed` : ''
        }. Venues have been marked as reached out.`
      );
      setAction(null);
    } catch (err) {
      setError(errorText(err, 'Sending failed.'));
    } finally {
      setActing(false);
    }
  };

  const newChat = () => {
    Alert.alert('Start a new chat?', "Today's conversation will be cleared. Earlier days stay in History on the website.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'New chat',
        style: 'destructive',
        onPress: async () => {
          setMessages([]);
          setAction(null);
          setError(null);
          try {
            await clearTodaysChat(dayRef.current);
          } catch (err) {
            console.warn('[assistant] clear failed', err);
          }
        },
      },
    ]);
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <StateMessage kind="empty" title="Band admins only" message="The booking assistant is available to band admins." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Assistant"
        subtitle="Ask, plan, update — you approve every change"
        right={<AccountButton />}
      />
      <RetroStripes height={4} gap={2} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
        {loadError ? (
          <StateMessage kind="error" title="Chat didn't load" message={loadError} actionLabel="Try again" onAction={chat.refresh} />
        ) : !loaded ? (
          <StateMessage kind="loading" />
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.thread}
            keyboardShouldPersistTaps="handled">
            {messages.length === 0 && !thinking ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>What should we work on?</Text>
                <Text style={styles.emptyText}>
                  The same assistant as the website. It can look things up and line up changes, but nothing is saved or
                  sent until you approve it here.
                </Text>
                <View style={styles.chips}>
                  {SUGGESTIONS.map((s) => (
                    <Pressable key={s} accessibilityRole="button" onPress={() => send(s)} style={styles.chip}>
                      <Text style={styles.chipText}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {messages.map((m, i) => (
              <View
                key={`${i}-${m.role}`}
                style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.botBubble]}
                accessibilityLabel={`${m.role === 'user' ? 'You' : 'Assistant'}: ${m.content}`}>
                <Text selectable style={m.role === 'user' ? styles.userText : styles.botText}>
                  {m.content}
                </Text>
              </View>
            ))}

            {thinking ? (
              <View style={[styles.bubble, styles.botBubble, styles.thinking]} accessibilityLabel="Assistant is thinking">
                <ActivityIndicator color={colors.orange} />
                <Text style={styles.botText}>Thinking…</Text>
              </View>
            ) : null}

            {action?.type === 'stage_items' ? (
              <ApprovalCard
                items={action.staged}
                errors={action.errors ?? []}
                overflow={action.overflow ?? 0}
                busy={acting}
                onConfirm={confirm}
                onCancel={() => setAction(null)}
              />
            ) : null}
            {action && (action.type === 'tour_outreach' || action.type === 'city_search') ? (
              <OutreachCard
                key={action.type === 'tour_outreach' ? action.tourId : `${action.city}-${action.state}`}
                action={action}
                actName={actName}
                busy={acting}
                onSend={sendEmails}
                onCancel={() => setAction(null)}
              />
            ) : null}
            {action?.type === 'find_venue' && action.venues.length > 0 ? (
              <View style={styles.found}>
                {action.venues.map((v) => (
                  <Text key={v.id ?? v.name} style={styles.botText}>
                    • {v.name}
                    {v.city ? ` — ${[v.city, v.state].filter(Boolean).join(', ')}` : ''}
                    {v.email ? ` · ${v.email}` : ''}
                  </Text>
                ))}
              </View>
            ) : null}

            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
          </ScrollView>
        )}

        <View style={styles.composer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New chat"
            onPress={newChat}
            disabled={thinking || messages.length === 0}
            style={[styles.iconButton, (thinking || messages.length === 0) && styles.dim]}>
            <Ionicons name="refresh-outline" size={22} color={colors.textMuted} />
          </Pressable>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask the assistant…"
            placeholderTextColor={colors.textSubtle}
            multiline
            maxLength={MAX_INPUT}
            editable={loaded && !thinking}
            accessibilityLabel="Message to the assistant"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={() => send(input)}
            disabled={!input.trim() || thinking || !loaded}
            style={[styles.sendButton, (!input.trim() || thinking || !loaded) && styles.dim]}>
            <Ionicons name="arrow-up" size={22} color={colors.onInteractive} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: READABLE_MAX_WIDTH, alignSelf: 'center', backgroundColor: colors.background },
  flex: { flex: 1 },
  thread: { padding: space.lg, gap: space.md, paddingBottom: space['2xl'] },
  empty: { gap: space.md, paddingVertical: space.lg },
  emptyTitle: { ...type.heading, color: colors.cream },
  emptyText: { ...type.base, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: { ...type.sm, color: colors.cream },
  bubble: { maxWidth: '88%', borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.orange },
  botBubble: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  userText: { ...type.base, color: colors.onInteractive },
  botText: { ...type.base, color: colors.cream },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  found: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.xs },
  error: { ...type.sm, color: colors.danger },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.tabBar,
  },
  input: {
    flex: 1,
    minHeight: touchTarget,
    maxHeight: 140,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    color: colors.cream,
    paddingHorizontal: space.md,
    paddingTop: 13,
    paddingBottom: 13,
    // 16px avoids iOS zooming into the field on focus.
    fontSize: 16,
    fontFamily: type.base.fontFamily,
  },
  iconButton: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  sendButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.4 },
});
