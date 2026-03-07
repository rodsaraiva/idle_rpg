import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';

export function VillageScreen() {
  const nav = useNavigation<any>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vila</Text>
      <View style={styles.grid}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Ir para Treinamento"
          style={styles.card}
          onPress={() => nav.navigate('Treinamento')}
        >
          <Text style={styles.cardTitle}>Treinamento</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Ir para Enfermaria"
          style={styles.card}
          onPress={() => nav.navigate('Enfermaria')}
        >
          <Text style={styles.cardTitle}>Enfermaria</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Ir para o Ferreiro"
          style={styles.card}
          onPress={() => nav.navigate('Ferreiro')}
        >
          <Text style={styles.cardTitle}>Ferreiro</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Ir para o Panteão"
          style={styles.card}
          onPress={() => nav.navigate('Panteao')}
        >
          <Text style={styles.cardTitle}>Panteão</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
  },
  cardTitle: { color: theme.colors.textPrimary, fontWeight: '600' },
});

