import type { ReactElement } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function NextStepsScreen(): ReactElement {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.heading}>Start Building</Text>
        <Text style={styles.item}>1. Define the first game flow screen.</Text>
        <Text style={styles.item}>2. Add state and API adapters.</Text>
        <Text style={styles.item}>3. Wire up native platform services.</Text>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10
  },
  heading: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8
  },
  item: {
    color: '#d0d5dd',
    fontSize: 16
  }
});
