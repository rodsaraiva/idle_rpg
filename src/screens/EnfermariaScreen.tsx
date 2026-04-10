import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { theme } from '../theme';
import { GoldDisplay } from '../components/GoldDisplay';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { HeroCard } from '../components/HeroCard';
import { Hero } from '../types';
import { useInfirmary } from '../hooks/useInfirmary';
import { LoadingScreen } from '../components/ui/LoadingScreen';

export function EnfermariaScreen() {
  const {
    state,
    isLoaded,
    injuredIdle,
    inInfirmary,
    selectedIds,
    toggleSelection,
    sendToInfirmary,
    releaseFromInfirmary,
  } = useInfirmary();

  if (!isLoaded) {
    return <LoadingScreen message="Carregando enfermaria..." />;
  }

  const renderSelectable = ({ item }: { item: Hero }) => (
    <HeroCard 
      hero={item} 
      variant="compact" 
      selected={selectedIds.includes(item.id)} 
      onToggle={toggleSelection} 
    />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Enfermaria Real"
          subtitle={`${injuredIdle.length} herói${injuredIdle.length !== 1 ? 's' : ''} aguardando cuidados`}
          right={<GoldDisplay gold={state.gold} />}
        />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Em Tratamento</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{inInfirmary.length}</Text>
            </View>
          </View>
          
          {inInfirmary.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Nenhum herói ocupando leitos no momento.</Text>
            </View>
          ) : (
            inInfirmary.map((h) => (
              <HeroCard
                key={h.id}
                hero={h}
                actions={[
                  {
                    label: 'Dar Alta',
                    color: theme.colors.textMuted,
                    onPress: () => releaseFromInfirmary(h.id),
                  },
                ]}
              />
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Fila de Espera</Text>
            {selectedIds.length > 0 && (
              <Text style={styles.selectionCount}>{selectedIds.length} selecionados</Text>
            )}
          </View>

          {injuredIdle.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Todos os heróis ociosos estão saudáveis!</Text>
            </View>
          ) : (
            <>
              <View style={styles.listContent}>
                {injuredIdle.map((item) => (
                  <React.Fragment key={item.id}>
                    {renderSelectable({ item })}
                  </React.Fragment>
                ))}
              </View>
              
              <TouchableOpacity 
                style={[
                  styles.submitButton, 
                  selectedIds.length === 0 && styles.submitButtonDisabled
                ]} 
                onPress={sendToInfirmary} 
                disabled={selectedIds.length === 0}
                activeOpacity={0.8}
              >
                <Text style={styles.submitButtonText}>Internar Heróis</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: theme.colors.background 
  },
  container: { 
    paddingHorizontal: theme.spacing.md, 
    paddingTop: theme.spacing.md, 
    paddingBottom: theme.spacing.xl 
  },
  section: { 
    marginTop: theme.spacing.lg 
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    gap: 8,
  },
  sectionTitle: { 
    fontSize: 16,
    fontWeight: '700', 
    color: theme.colors.textPrimary, 
  },
  badge: {
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  selectionCount: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyText: { 
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: { 
    paddingBottom: theme.spacing.sm 
  },
  submitButton: { 
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    elevation: 3,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.2)',
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.surfaceLight,
    opacity: 0.5,
  },
  submitButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: 14,
    textTransform: 'uppercase',
  },
});
