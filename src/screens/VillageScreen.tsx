import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ImageBackground } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
import { IMAGE_ASSETS } from '../constants/assets';

export function VillageScreen() {
  const nav = useNavigation<any>();

  const VillageCard = ({ title, icon, description, screen }: { title: string; icon: string; description: string; screen: string }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.card}
      onPress={() => nav.navigate(screen)}
    >
      <View style={styles.cardIconContainer}>
        <Text style={styles.cardIcon}>{icon}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={IMAGE_ASSETS.VILLAGE_MAP} 
        style={styles.header}
        imageStyle={styles.headerImage}
      >
        <View style={styles.headerOverlay}>
          <Text style={styles.title}>Vila de Ouro</Text>
          <Text style={styles.subtitle}>O coração da sua guilda</Text>
        </View>
      </ImageBackground>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.grid}>
          <VillageCard 
            title="Treinamento" 
            icon="⚔️" 
            description="Melhore os atributos dos seus heróis"
            screen="Treinamento"
          />
          <VillageCard 
            title="Enfermaria" 
            icon="🩺" 
            description="Recupere heróis feridos em batalha"
            screen="Enfermaria"
          />
          <VillageCard 
            title="Ferreiro" 
            icon="⚒️" 
            description="Forje e melhore equipamentos (Em breve)"
            screen="Ferreiro"
          />
          <VillageCard 
            title="Panteão" 
            icon="🏛️" 
            description="Honre seus heróis lendários (Em breve)"
            screen="Panteao"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme.colors.background 
  },
  header: {
    height: 180,
    justifyContent: 'flex-end',
  },
  headerImage: {
    opacity: 0.6,
  },
  headerOverlay: {
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  title: { 
    fontSize: 28, 
    fontWeight: '800', 
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  scrollContent: {
    padding: 16,
  },
  grid: { 
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardIcon: {
    fontSize: 28,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: { 
    color: theme.colors.textPrimary, 
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardDescription: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
});
