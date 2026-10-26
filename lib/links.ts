// lib/links.ts
// Opening phone, email, maps and web links from anywhere in the app.
import { Linking, Platform } from 'react-native';

/** Opens a URL; logs and swallows failures (e.g. no mail app installed). */
export async function openSafely(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch (err) {
    console.warn('[links] could not open', url, err);
    return false;
  }
}

/** The platform's maps app searching for `query`. */
export function mapsUrl(query: string): string {
  const q = encodeURIComponent(query);
  return Platform.OS === 'ios' ? `maps:?q=${q}` : Platform.OS === 'android' ? `geo:0,0?q=${q}` : `https://maps.google.com/?q=${q}`;
}

/** `tel:` link with everything but digits and a leading + removed. */
export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** A website link with https:// added when the stored value has no scheme. */
export function webUrl(site: string): string {
  return /^https?:\/\//i.test(site) ? site : `https://${site}`;
}
