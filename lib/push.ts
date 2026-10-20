// lib/push.ts
//
// Push notifications: ask permission, get this device's Expo push token and
// save it to Supabase so the server can send show-day reminders.
//
// The token is saved through the `register_push_token` RPC (see the web repo
// migration 20261020190000_push_tokens.sql). RLS limits each user to their
// own tokens; the RPC also moves a token to the new user when a phone
// changes hands.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/** Android channel for show reminders (Android 8+ requires a channel). */
export const SHOWS_CHANNEL_ID = 'shows';

/** Data the server attaches to a show reminder. */
export interface ShowNotificationData {
  type?: string;
  bookingId?: string;
}

let lastRegisteredToken: string | null = null;

function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

/**
 * Asks for notification permission (once; iOS never re-prompts after a
 * "Don't Allow"), then registers this device's push token for the signed-in
 * user. Safe to call on every launch: it does nothing without permission.
 *
 * @returns the Expo push token, or null when push isn't available or allowed
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null; // simulators and web can't receive push

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(SHOWS_CHANNEL_ID, {
      name: 'Show reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!granted && existing.canAskAgain) {
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    granted = asked.granted;
  }
  if (!granted) return null;

  const id = projectId();
  if (!id) {
    console.warn('[push] no EAS projectId in app config; skipping registration');
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  if (token !== lastRegisteredToken) {
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    if (error) throw new Error(`Couldn't save push token: ${error.message}`);
    lastRegisteredToken = token;
  }
  return token;
}

/**
 * Removes this device's token for the signed-in user, so a signed-out phone
 * stops getting that person's reminders. Call before signing out (it needs
 * the session). Never throws: sign-out must always succeed.
 */
export async function unregisterPushToken(): Promise<void> {
  const token = lastRegisteredToken;
  if (!token) return;
  try {
    const { error } = await supabase.from('push_tokens').delete().eq('token', token);
    if (error) console.warn('[push] could not remove token on sign-out', error.message);
  } catch (err) {
    console.warn('[push] could not remove token on sign-out', err);
  } finally {
    lastRegisteredToken = null;
  }
}

/** Reads the show id from a tapped notification, if it is a show reminder. */
export function bookingIdFromNotification(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const id = (data as ShowNotificationData).bookingId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}
