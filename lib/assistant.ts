// lib/assistant.ts
// The booking assistant from the website's /band page, for band admins on the
// phone. Everything goes through the website's own API routes (Bearer auth),
// so the assistant's rules — admin-only, no money changes or deletions
// without approval, nothing saved until the user taps Confirm — are enforced
// in exactly one place: the server.
import { toISODate } from './dates';
import { API_BASE, ApiError, authHeader } from './memberShows';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** One proposed change waiting on the approval card. */
export interface StagedItem {
  kind: string;
  staged_action_id: string;
  /** One-line description, written by the server (web PR #167). */
  summary?: string;
  /** Warning when confirming emails someone, deletes, invites or overwrites. */
  caution?: string | null;
  conflicts?: unknown[];
}

export interface OutreachVenue {
  /** Present on tour outreach; city search uses `id`. */
  tourVenueId?: string;
  venueId?: string;
  id?: string;
  name: string;
  city?: string | null;
  state?: string | null;
  email?: string | null;
  contactName?: string | null;
}

export type AssistantAction =
  | { type: 'stage_items'; staged: StagedItem[]; errors: string[]; overflow?: number }
  | {
      type: 'tour_outreach';
      tourId: string;
      tourName: string;
      stage?: 'target' | 'follow_up';
      venues: OutreachVenue[];
      draft: { subject: string; body: string };
      draftSource?: 'agreed' | 'generated';
    }
  | {
      type: 'city_search';
      city: string;
      state: string;
      dateRange: string;
      venues: OutreachVenue[];
      activeTour: { id: string; name: string } | null;
    }
  | { type: 'find_venue'; venues: OutreachVenue[] };

export interface AssistantReply {
  reply: string;
  action: AssistantAction | null;
}

/** Most messages sent back as context; matches what the website keeps per day. */
const MAX_HISTORY = 40;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...(await authHeader()), 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok && !(json && Array.isArray(json.results))) {
    const message = typeof json?.error === 'string' ? json.error : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return json as T;
}

/** Today's date on the phone — the assistant keeps one chat per local day. */
export function todayKey(now: Date = new Date()): string {
  return toISODate(now);
}

/** Today's saved chat, or an empty list if there isn't one yet. */
export async function loadTodaysChat(day: string = todayKey()): Promise<ChatMessage[]> {
  const json = await request<{ messages?: ChatMessage[] }>(`/api/agent-conversation?day=${encodeURIComponent(day)}`);
  return Array.isArray(json.messages) ? json.messages : [];
}

/** Saves today's chat. Failures are logged, not thrown: the chat itself keeps working. */
export async function saveTodaysChat(messages: ChatMessage[], day: string = todayKey()): Promise<void> {
  try {
    await request('/api/agent-conversation', { method: 'PUT', body: JSON.stringify({ day, messages }) });
  } catch (err) {
    console.warn('[assistant] chat save failed', err);
  }
}

/** Clears today's chat ("New chat"). */
export async function clearTodaysChat(day: string = todayKey()): Promise<void> {
  await request(`/api/agent-conversation?day=${encodeURIComponent(day)}`, { method: 'DELETE' });
}

/** Sends one message with the prior conversation as context. */
export async function askAssistant(message: string, history: ChatMessage[]): Promise<AssistantReply> {
  const json = await request<{ reply?: string; action?: AssistantAction }>('/api/agent', {
    method: 'POST',
    body: JSON.stringify({
      message,
      history: history.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  return { reply: json.reply ?? '', action: json.action ?? null };
}

export interface ConfirmResult {
  staged_action_id: string;
  success: boolean;
  error?: string;
}

/** Saves everything on an approval card. Returns per-item results (some may fail). */
export async function confirmStaged(items: StagedItem[]): Promise<ConfirmResult[]> {
  const json = await request<{ results?: ConfirmResult[] }>('/api/help/actions/execute', {
    method: 'POST',
    body: JSON.stringify({ staged_action_ids: items.map((i) => i.staged_action_id) }),
  });
  return json.results ?? items.map((i) => ({ staged_action_id: i.staged_action_id, success: true }));
}

/** Plain-language result line for the chat after Confirm, built from what actually saved. */
export function describeConfirm(items: StagedItem[], results: ConfirmResult[]): string {
  const byId = new Map(results.map((r) => [r.staged_action_id, r]));
  const saved: string[] = [];
  const failed: string[] = [];
  for (const item of items) {
    const label = item.summary || item.kind.replace(/_/g, ' ');
    const r = byId.get(item.staged_action_id);
    if (r?.success) saved.push(`• ${label}`);
    else failed.push(`• ${label} — ${r?.error ? r.error.slice(0, 100) : 'save failed'}`);
  }
  const parts: string[] = [];
  if (saved.length) parts.push(`Saved:\n${saved.join('\n')}`);
  if (failed.length) parts.push(`Failed:\n${failed.join('\n')}`);
  return parts.join('\n') || 'No items were processed.';
}

export interface OutreachSendResult {
  sent: number;
  noEmail: number;
  errors: number;
}

/**
 * Sends the reviewed outreach email to the chosen venues from the band's
 * connected Gmail. `actId` must be the caller's own band; the server rejects
 * anything else.
 */
export async function sendOutreach(params: {
  actId: string;
  action: Extract<AssistantAction, { type: 'tour_outreach' | 'city_search' }>;
  selected: OutreachVenue[];
  subject: string;
  body: string;
}): Promise<OutreachSendResult> {
  const { actId, action, selected, subject, body } = params;
  const payload =
    action.type === 'tour_outreach'
      ? { venues: selected, subject, body, actId, tourId: action.tourId }
      : {
          venues: selected.map((v) => ({
            venueId: v.id,
            name: v.name,
            city: v.city,
            state: v.state,
            email: v.email,
            contactName: null,
          })),
          subject,
          body,
          actId,
          tourId: action.activeTour?.id ?? null,
          addToTour: !!action.activeTour,
        };
  return request<OutreachSendResult>('/api/agent-bulk-send', { method: 'POST', body: JSON.stringify(payload) });
}

/** Stable key for a venue row on either outreach card. */
export function venueKey(v: OutreachVenue): string {
  return v.tourVenueId ?? v.id ?? v.venueId ?? v.name;
}
