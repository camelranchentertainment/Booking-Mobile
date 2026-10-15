# Camel Ranch Booking — iPhone & Android app

The companion app for [camelranchbooking.com](https://camelranchbooking.com). Built with Expo (SDK 57) and Expo Router, talking to the same Supabase project as the web app. Row-level security in Supabase decides what each signed-in person can see; the app never filters by act on trust alone.

## What's in the app

| Tab | What it shows | Who can edit |
| --- | --- | --- |
| **Shows** | Every upcoming show, soonest first, with status | Band admins edit from the day sheet |
| **Calendar** | Month grid with a colored bar per show; tap a day to see its shows | Band admins edit from the day sheet |
| **Day Sheet** | The next confirmed show: run of show, venue contact (tap to call), directions | Band admins ("Edit show details") |
| **Band** | Active roster from the band's Members page, tap to call; account and sign out | No one (manage on the website) |

## Look and feel

All colors, type and spacing come from `lib/theme.ts`. The 70s pieces (groovy stacked-shadow titles, stripes, buttons, status pills, loading/error/empty states) live in `components/retro.tsx`. Fonts are Shrikhand (titles), Bebas Neue (labels) and Inter (body), loaded before the splash screen hides.

## Run it locally

1. `npm ci`
2. Create `.env` (never commit it):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://ffnhrwfkiryohocscthu.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key from Supabase → Project Settings → API>
   ```
3. `npx expo start`

Before every commit: `npx tsc --noEmit` and `npx expo lint` must both pass with no errors.

## Store identity (permanent — do not change after the first upload)

| | Value |
| --- | --- |
| iOS bundle ID | `com.camelranchbooking.app` |
| Android package | `com.camelranchbooking.app` |
| Home-screen name | Camel Ranch |
| Store listing name | Camel Ranch Booking (set in App Store Connect / Play Console) |

## Building for the stores (EAS)

Builds run in Expo's cloud, so no Mac is needed. One-time setup, run from this folder:

```bash
npm install -g eas-cli
eas login                      # Expo account
eas init                       # links this project; adds "owner" + "extra.eas.projectId" to app.json — commit that
eas env:set --name EXPO_PUBLIC_SUPABASE_URL --value https://ffnhrwfkiryohocscthu.supabase.co --environment production --visibility plaintext
eas env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <publishable key> --environment production --visibility plaintext
# repeat both for --environment preview
```

Then:

```bash
eas build --platform ios --profile production       # signs in to Apple and creates certificates for you
eas build --platform android --profile production
eas submit --platform ios --latest                  # uploads to App Store Connect / TestFlight
eas submit --platform android --latest              # uploads to Google Play (needs a Play service-account key)
```

`preview` builds are internal test builds (an installable `.apk` on Android). Build numbers auto-increment on the EAS side (`appVersionSource: remote`).
