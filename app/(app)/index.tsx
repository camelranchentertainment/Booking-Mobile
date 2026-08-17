import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

const COLORS = {
  background: '#0E1628',
  accent: '#E8602A',
  text: '#F5EDD9',
  taglineBlue: '#6B8FB5',
};

export default function HomeScreen() {
  const { profile, loading, error, signOut } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.button} onPress={signOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}
      </Text>
      <Text style={styles.role}>Role: {profile?.role ?? 'unknown'}</Text>
      <Text style={styles.subtitle}>
        Calendar, day sheets, and roster land in the next phases.
      </Text>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
        onPress={signOut}
      >
        <Text style={styles.buttonText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  role: {
    color: COLORS.taglineBlue,
    fontSize: 14,
    marginBottom: 20,
  },
  subtitle: {
    color: '#8A96B5',
    fontSize: 14,
    marginBottom: 32,
  },
  errorText: {
    color: '#E85A5A',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
