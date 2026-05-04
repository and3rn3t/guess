import { StatusBar } from 'expo-status-bar'
import type { ReactElement } from 'react'
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

export default function App(): ReactElement {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.card}>
        <Text style={styles.eyebrow}>iOS Native Preview</Text>
        <Text style={styles.title}>Andernator Mobile</Text>
        <Text style={styles.body}>
          This app shell is intentionally native-first. Web UI components are blocked by guardrails.
        </Text>
        <Pressable accessibilityRole="button" style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Start Native Build</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0b1220',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#111b30',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1f2a44',
    gap: 10,
  },
  eyebrow: {
    color: '#86a3ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 34,
  },
  body: {
    color: '#c7d2fe',
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
})
