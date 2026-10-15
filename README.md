# Camel Ranch Booking — iPhone & Android app

The companion app for [camelranchbooking.com](https://camelranchbooking.com). Built with Expo (SDK 57) and Expo Router, talking to the same Supabase project as the web app. Row-level security in Supabase decides what each signed-in person can see; the app never filters by act on trust alone.

## What's in the app

Four tabs, plus a Band & account screen from the person icon in each header.

| Tab | Members see | Band admins see |
| --- | --- | --- |
| **Shows** | Upcoming shows they're on, with their own answer (You're in / Answer needed / Can't make it) | Every upcoming show in the pipeline with its status |
| **Calendar** | Their shows on a month grid, colored by their answer | All shows, colored by pipeline status |
| **Pay** | Their pay per show: coming up, and earned in a chosen year ("Set" by the admin or "Estimate" from their usual rate) | Their own pay, if they're on the roster |
| **Day Sheet** | Run of show, venue contact, directions, hospitality, **"Can you make it?"** buttons and their pay | Run of show, venue, hospitality, plus **Edit show details** |

Members never receive the band's fee or deal notes: their booking queries don't select those columns, and their pay and answers go through the website's `/api/member/shows` routes, which only return the caller's own rows.

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
| Expo project | @camelranchentertainment/Booking-Mobile |
| Home-screen name | Camel Ranch |
| Store listing name | Camel Ranch Booking (set in App Store Connect / Play Console) |

## Building for the stores (EAS)

The app is linked to the Expo project **@camelranchentertainment/Booking-Mobile** (`app.json` → `owner`, `extra.eas.projectId`). The Supabase URL and *publishable* key live in `eas.json`; both are public by design (Row-Level Security protects the data), the same values the website ships to every browser.

**Builds run from GitHub, no terminal needed:** Actions → **EAS Build** → *Run workflow* → choose `ios`, `android` or `all`. The workflow type-checks and lints first, then queues the build in Expo's cloud. It needs a repository secret named `EXPO_TOKEN` (an Expo personal access token).

**One-time exception — iOS signing:** Apple requires a person to sign in (with 2-factor) the first time certificates are created, and CI can't do that. Once, from a terminal in this repo:

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform ios --profile production   # sign in to Apple when asked; say yes to generating credentials
```

After that, every iOS build (and Android) can run from the GitHub button. To send a finished build to TestFlight / Google Play, tick **submit** when running the workflow (production profile).
