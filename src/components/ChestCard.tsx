import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface ChestCardProps {
  label: string;
  cost: number;
  canAfford: boolean;
  onPress: () => void;
  description?: string;
  icon?: string;
}

export function ChestCard({ label, cost, canAfford, onPress, description, icon = '🎁' }: ChestCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.container, !canAfford && styles.disabled]}
      onPress={onPress}
      disabled={!canAfford}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
        
        <View style={styles.priceTag}>
          <Text style={[styles.priceText, !canAfford && styles.priceTextDisabled]}>
            💰 {Math.floor(cost)}
          </Text>
        </View>
      </View>

      <View style={[styles.buyButton, !canAfford && styles.buyButtonDisabled]}>
        <Text style={styles.buyButtonText}>{canAfford ? 'COMPRAR' : 'POBRE'}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
    marginBottom: 12,
    elevation: 3,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
  },
  disabled: {
    opacity: 0.8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  icon: {
    fontSize: 32,
  },
  content: {
    flex: 1,
  },
  label: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceText: {
    color: theme.colors.gold,
    fontWeight: '800',
    fontSize: 16,
  },
  priceTextDisabled: {
    color: '#ff4d4d',
  },
  buyButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  buyButtonDisabled: {
    backgroundColor: theme.colors.surfaceLight,
  },
  buyButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '900',
    fontSize: 11,
  },
});
