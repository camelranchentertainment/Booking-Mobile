import { Image } from 'expo-image';
import React, { useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroovyText, RetroButton, RetroStripes } from '../../components/retro';
import { useAuth } from '../../contexts/AuthContext';
import { colors, fonts, radius, space, touchTarget, type } from '../../lib/theme';

const LOGIN_MAX_WIDTH = 480;

const RESET_PASSWORD_URL = 'https://camelranchbooking.com/reset-password';
const EMBLEM = require('../../assets/images/logo-emblem.png');

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    if (submitting) return; // prevent double-submission

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setFormError('Enter both email and password.');
      AccessibilityInfo.announceForAccessibility('Enter both email and password.');
      return;
    }

    setFormError(null);
    setSubmitting(true);
    const { error } = await signIn(trimmedEmail, password);
    setSubmitting(false);

    if (error) {
      setFormError(error);
      AccessibilityInfo.announceForAccessibility(`Sign in failed: ${error}`);
    }
    // On success, onAuthStateChange in AuthContext updates session state,
    // and useRequireAuth in the root layout handles the redirect — no
    // manual navigation call needed here.
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Image
              source={EMBLEM}
              style={styles.emblem}
              contentFit="contain"
              accessibilityIgnoresInvertColors
              alt=""
              accessible={false}
            />
            <GroovyText size={44} align="center">
              Camel Ranch
            </GroovyText>
            <Text style={styles.wordmark}>BOOKING</Text>
            <Text style={styles.tagline}>Your shows, in your pocket.</Text>
          </View>

          <View style={styles.field}>
            <Text nativeID="emailLabel" style={styles.label}>
              EMAIL
            </Text>
            <TextInput
              accessibilityLabelledBy="emailLabel"
              aria-labelledby="emailLabel"
              style={[styles.input, focused === 'email' && styles.inputFocused]}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@yourband.com"
              placeholderTextColor={colors.textSubtle}
              editable={!submitting}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              submitBehavior="submit"
            />
          </View>

          <View style={styles.field}>
            <Text nativeID="passwordLabel" style={styles.label}>
              PASSWORD
            </Text>
            <TextInput
              ref={passwordRef}
              accessibilityLabelledBy="passwordLabel"
              aria-labelledby="passwordLabel"
              style={[styles.input, focused === 'password' && styles.inputFocused]}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              editable={!submitting}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
          </View>

          {formError && (
            <Text style={styles.error} accessibilityLiveRegion="assertive" accessibilityRole="alert">
              {formError}
            </Text>
          )}

          <View style={styles.submit}>
            <RetroButton label="Sign in" onPress={handleSubmit} busy={submitting} />
          </View>

          <Pressable
            accessibilityRole="link"
            accessibilityHint="Opens camelranchbooking.com in your browser"
            onPress={() => Linking.openURL(RESET_PASSWORD_URL).catch(() => {})}
            style={styles.linkBtn}>
            <Text style={styles.link}>Forgot your password?</Text>
          </Pressable>

          <Text style={styles.footnote}>Accounts are set up by your band admin on camelranchbooking.com.</Text>
        </ScrollView>
        <RetroStripes height={10} gap={4} />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  // The sign-in form stays phone-width on iPad, the iPhone Duo and Mac.
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: LOGIN_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: space['2xl'],
    paddingVertical: space['3xl'],
  },
  brand: { alignItems: 'center', marginBottom: space['3xl'] },
  emblem: { width: 168, height: 136, marginBottom: space.sm },
  wordmark: { fontFamily: fonts.label, fontSize: 26, letterSpacing: 10, color: colors.orange, marginTop: -space.xs },
  tagline: { ...type.base, color: colors.textMuted, marginTop: space.xs },
  field: { marginBottom: space.lg },
  label: { ...type.label, fontSize: 16, color: colors.mustard, marginBottom: space.xs },
  input: {
    backgroundColor: colors.surface,
    color: colors.cream,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontFamily: fonts.body,
    fontSize: 16,
    minHeight: touchTarget + 4,
    borderWidth: 2,
    borderColor: colors.border,
  },
  inputFocused: { borderColor: colors.orange },
  error: { ...type.md, color: colors.danger, marginBottom: space.md, textAlign: 'center' },
  submit: { marginTop: space.sm },
  linkBtn: { alignSelf: 'center', minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: space.md },
  link: { ...type.md, color: colors.mustard },
  footnote: { ...type.sm, color: colors.textSubtle, textAlign: 'center' },
});
