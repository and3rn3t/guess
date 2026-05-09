import type { ReactElement } from 'react';
import { Link } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen(): ReactElement {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>New iOS Project</Text>
        <Text style={styles.subtitle}>Fresh Expo baseline for Guess mobile.</Text>
        <Link href="/next-steps" style={styles.link}>
          Open next steps
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b1020'
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '700'
  },
  subtitle: {
    color: '#98a2b3',
    fontSize: 16,
    textAlign: 'center'
  },
  link: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8
  }
});
