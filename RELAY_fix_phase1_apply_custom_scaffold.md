# RELAY TO CLAUDE CODE — Correction: apply the actual Phase 1 scaffold

**Context:** The previous "Scaffold a new Expo app here" step ran a stock `create-expo-app@latest` template only. It did NOT include the custom auth/Supabase work from the original Phase 1 relay doc. Verified directly:

```
ls /workspaces/Booking-Mobile/app        → not present
cat /workspaces/Booking-Mobile/lib/supabase.ts        → not present
cat /workspaces/Booking-Mobile/contexts/AuthContext.tsx → not present
```

This document supersedes that step. Do not run `create-expo-app` again. Apply the following into the **existing** project.

---

## Step 1: Normalize the router root

The current scaffold put the Expo Router root at `src/app/` instead of `app/` at the project root. Standardize on `app/` at the project root (the convention the rest of this document assumes):

```bash
cd /workspaces/Booking-Mobile
git mv src/app app
# Move any other src/ subfolders you find (e.g. src/assets) to project root the same way, or leave assets/ where it already sits if create-expo-app put it at root.
rmdir src 2>/dev/null || true
```

Then confirm `app.json` / `package.json` `"main"` entry and any `app-root` config reference `app/`, not `src/app/`, and fix if not. Run `npx expo start` afterward specifically to confirm the router still resolves `app/_layout.tsx` correctly once you add it below — don't just assume the move worked.

---

## Step 2: Install the missing dependencies

```bash
npx expo install expo-secure-store expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar react-native-url-polyfill
npm install @supabase/supabase-js
```

Check `package.json` afterward to confirm each of these actually landed — don't assume from install log output alone.

---

## Step 3: Add `.env` (do not commit this file)

```bash
# .env
EXPO_PUBLIC_SUPABASE_URL=<pull from Vercel NEXT_PUBLIC_SUPABASE_URL — same value>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<pull from Vercel NEXT_PUBLIC_SUPABASE_ANON_KEY — same value>
```

Confirm `.env` is listed in `.gitignore`. If `.gitignore` doesn't already exclude it (check first, don't just append blindly), add it.

---

## Step 4: Create the files below exactly as specified

Create each of these files with this exact content. These are unchanged from the original Phase 1 relay doc — copy them verbatim.

### `lib/supabase.ts`
### `contexts/AuthContext.tsx`
### `hooks/useRequireAuth.ts`
### `app/_layout.tsx`
### `app/(auth)/_layout.tsx`
### `app/(auth)/login.tsx`
### `app/(app)/_layout.tsx`
### `app/(app)/index.tsx`
### `tsconfig.json` (merge with/replace the existing one from create-expo-app)

**→ Full file contents for all of the above are in the file `RELAY_mobile_scaffold_phase1.md` from the earlier message in this conversation (Steps 4–10). Use those exact contents — do not regenerate, paraphrase, or "improve" them. If any file already exists from the stock scaffold (e.g. a default `app/_layout.tsx` if one exists after Step 1's move), overwrite it with the version from that document.**

---

## Step 5: Verify — actually verify, don't just report

Run and show real output for every one of these before claiming this phase complete:

```bash
ls app/ lib/ contexts/ hooks/
cat lib/supabase.ts | head -5
cat contexts/AuthContext.tsx | head -5
npx tsc --noEmit
npx expo start --tunnel
```

Do not report "done," "verified," or "scaffolded" for this phase again without pasting the actual output of these commands. The last three claims of completion in this session did not hold up under a direct file check — this phase is only done when `ls app/ lib/ contexts/ hooks/` shows the real files and `cat`ing them shows the actual custom code, not empty/missing output.

---

## Step 6: Once verified, commit as its own clean commit

```bash
git add -A
git commit -m "Apply custom auth scaffold: Supabase client, AuthContext, login screen, route guard"
git push
```

Then report back: does `git show --stat HEAD` show `lib/supabase.ts`, `contexts/AuthContext.tsx`, `app/(auth)/login.tsx`, `app/(app)/index.tsx`, `hooks/useRequireAuth.ts` in the file list? If not, do not report success.
