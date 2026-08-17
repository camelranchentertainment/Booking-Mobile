import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

const COLORS = {
  background: '#0E1628',
  accent: '#E8602A',
  text: '#F5EDD9',
  taglineBlue: '#6B8FB5',
  inputBackground: '#1A2540',
  errorRed: '#E85A5A',
};

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          Camel Ranch Booking
        </Text>
        <Text style={styles.tagline}>Sign in to your account</Text>

        <View style={styles.field}>
          <Text nativeID="emailLabel" style={styles.label}>
            Email
          </Text>
          <TextInput
            accessibilityLabelledBy="emailLabel"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
            placeholderTextColor="#6B7A99"
            editable={!submitting}
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text nativeID="passwordLabel" style={styles.label}>
            Password
          </Text>
          <TextInput
            accessibilityLabelledBy="passwordLabel"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            placeholder="••••••••"
            placeholderTextColor="#6B7A99"
            editable={!submitting}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
        </View>

        {formError && (
          <Text style={styles.error} accessibilityLiveRegion="assertive">
            {formError}
          </Text>
        )}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting, busy: submitting }}
          style={({ pressed }) => [
            styles.button,
            submitting && styles.buttonDisabled,
            pressed && !submitting && styles.buttonPressed,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.background} />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  tagline: {
    color: COLORS.taglineBlue,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: COLORS.text,
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.inputBackground,
    color: COLORS.text,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48, // 48dp minimum touch target
    borderWidth: 1,
    borderColor: '#2A3655',
  },
  error: {
    color: COLORS.errorRed,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
