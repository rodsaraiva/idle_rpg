import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { theme } from '../theme';
import { AnimatedGold } from '../components/AnimatedGold';
import { Banner } from '../components/ui/Banner';
import { ScreenContainer } from '../components/ui/ScreenContainer';
import { Button } from '../components/ui/Button';
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
      equippedCosmetics={state.cosmetics?.equipped}
    />
  );

  return (
    <ScreenContainer
      banner={
        <Banner
          title="Enfermaria Real"
          subtitle={`${injuredIdle.length} herói${injuredIdle.length !== 1 ? 's' : ''} aguardando cuidados`}
          right={<AnimatedGold gold={state.gold} />}
        />
      }
    >

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
                equippedCosmetics={state.cosmetics?.equipped}
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
              
              <Button
                label="Internar Heróis"
                variant="gold"
                onPress={sendToInfirmary}
                disabled={selectedIds.length === 0}
              />
            </>
          )}
        </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: theme.colors.surfaceRaised,
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
    color: theme.colors.gold,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  emptyCard: {
    backgroundColor: theme.colors.surfaceRaised,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  submitButtonWrapper: {
    marginTop: theme.spacing.md,
  },
});
