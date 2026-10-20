// modules/watch-sync/index.ts
//
// JS face of the native WatchSync module. On Android, web, Expo Go or any
// build without the module it degrades to a no-op, so callers never need to
// check the platform.
import { requireOptionalNativeModule } from 'expo';

interface WatchSyncNative {
  isSupported(): boolean;
  updateShows(showsJson: string): void;
}

const native = requireOptionalNativeModule<WatchSyncNative>('WatchSync');

/** True when this phone can talk to an Apple Watch app. */
export function isWatchSyncSupported(): boolean {
  try {
    return native?.isSupported() ?? false;
  } catch {
    return false;
  }
}

/** Hands the shows (already serialized) to the watch. Never throws. */
export function sendShowsToWatch(showsJson: string): void {
  if (!native) return;
  try {
    native.updateShows(showsJson);
  } catch (err) {
    console.warn('[watch-sync] could not update the watch', err);
  }
}
