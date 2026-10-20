// hooks/usePushNotifications.ts
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { bookingIdFromNotification, registerForPushNotifications } from '../lib/push';

// Push is phone-only; the web preview has no notification support.
const PUSH_SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

// Show reminders as a banner even while the app is open.
if (PUSH_SUPPORTED)
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

/**
 * Call once inside the signed-in area. Registers this device for show
 * reminders, and opens the right day sheet when a reminder is tapped —
 * including the tap that launched the app.
 */
export function usePushNotifications(): void {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!PUSH_SUPPORTED || !userId) return;
    registerForPushNotifications().catch((err: unknown) => {
      // Non-fatal: the app works without push; we try again next launch.
      console.warn('[push] registration failed', err instanceof Error ? err.message : err);
    });
  }, [userId]);

  useEffect(() => {
    if (!PUSH_SUPPORTED) return;
    const open = (data: unknown) => {
      const bookingId = bookingIdFromNotification(data);
      if (bookingId) router.push({ pathname: '/daysheet', params: { show: bookingId } });
    };

    const launch = Notifications.getLastNotificationResponse();
    if (launch) {
      open(launch.notification.request.content.data);
      // Handle the launch tap once, not again after a later sign-in.
      Notifications.clearLastNotificationResponse();
    }

    const sub = Notifications.addNotificationResponseReceivedListener((response) =>
      open(response.notification.request.content.data),
    );
    return () => sub.remove();
  }, [router]);
}
