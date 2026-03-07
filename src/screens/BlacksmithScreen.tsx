import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

export function BlacksmithScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ferreiro</Text>
      <Text style={styles.text}>Aqui você poderá forjar e reparar equipamentos (em desenvolvimento).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 8 },
  text: { color: theme.colors.textSecondary },
});

