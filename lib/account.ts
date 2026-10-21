// lib/account.ts
//
// Self-service account deletion (App Store Guideline 5.1.1(v)).
//
// The website's DELETE /api/account/delete route does the work: it deletes
// only the signed-in caller, and refuses (409, with a user-facing reason)
// when deleting would remove band data, orphan a band, or leave a Stripe
// subscription billing — e.g. for band admins. The server is the authority;
// the app never decides on its own whether someone may delete.
import { API_BASE, authHeader } from './memberShows';

export type DeleteAccountResult =
  | { ok: true }
  /** `message` is safe to show the user as-is. */
  | { ok: false; message: string };

const NETWORK_MESSAGE = "We couldn't reach Camel Ranch Booking. Check your connection and try again.";
const GENERIC_MESSAGE = "Something went wrong and your account wasn't deleted. Please try again in a moment.";
const SESSION_MESSAGE = 'Your session has expired. Sign out, sign back in, and try again.';

/** Reads `{ error }` from a JSON body, or null when there isn't one. */
async function serverMessage(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: unknown };
    return typeof body.error === 'string' && body.error.trim() ? body.error : null;
  } catch {
    return null;
  }
}

/**
 * Permanently deletes the signed-in user's account on the server.
 * Never throws: every failure comes back as `{ ok: false, message }`.
 *
 * @returns `{ ok: true }` once the server has deleted the account
 */
export async function deleteMyAccount(): Promise<DeleteAccountResult> {
  let headers: Record<string, string>;
  try {
    headers = await authHeader();
  } catch {
    return { ok: false, message: SESSION_MESSAGE };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/account/delete`, { method: 'DELETE', headers });
  } catch (err) {
    console.warn('[account] delete request failed to send', err);
    return { ok: false, message: NETWORK_MESSAGE };
  }

  if (res.ok) return { ok: true };

  if (res.status === 401) return { ok: false, message: SESSION_MESSAGE };

  // 403/409 carry a reason written for the user (e.g. band admin hand-off).
  if (res.status === 403 || res.status === 409) {
    return { ok: false, message: (await serverMessage(res)) ?? GENERIC_MESSAGE };
  }

  console.warn(`[account] delete failed with status ${res.status}`);
  return { ok: false, message: GENERIC_MESSAGE };
}
