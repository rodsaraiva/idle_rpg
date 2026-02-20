import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

export function ShopScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <Text style={styles.title}>Loja</Text>
          <Text style={styles.subtitle}>Em breve: itens e consumíveis</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.md },
  title: { fontSize: theme.fontSize.xxl, fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary },
  empty: { color: theme.colors.textSecondary, marginTop: theme.spacing.md },
});

