import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  ImageBackground, 
  StatusBar 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
import { IMAGE_ASSETS } from '../constants/assets';
import { ScreenHeader } from '../components/ui/ScreenHeader';

export function VillageScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      
      {/* Header Padronizado e Totalmente Opaco */}
      <View style={styles.headerWrapper}>
        <ScreenHeader 
          title="Vila de Ouro" 
          subtitle="O coração da sua guilda"
          showGold={false} 
        />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner de Destaque da Vila */}
        {/* <View style={styles.bannerContainer}>
          <ImageBackground 
            source={IMAGE_ASSETS.VILLAGE_MAP} 
            style={styles.bannerImage}
            imageStyle={styles.bannerImageStyle}
          >
            <View style={styles.bannerOverlay} />
          </ImageBackground>
        </View> */}

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
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerWrapper: {
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  bannerContainer: {
    height: 120,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  bannerImage: {
    flex: 1,
  },
  bannerImageStyle: {
    opacity: 0.4,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 13, 35, 0.2)',
  },
  grid: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.surfaceLight,
    elevation: 2,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  cardIcon: {
    fontSize: 22,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardDescription: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
});
