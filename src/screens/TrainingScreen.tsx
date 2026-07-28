import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { AnimatedGold } from '../components/AnimatedGold';
import { Banner } from '../components/ui/Banner';
import { ScreenContainer } from '../components/ui/ScreenContainer';
import { EmptyState } from '../components/ui/EmptyState';
import { HeroCard } from '../components/HeroCard';
import { HeroDetailsModal } from '../components/HeroDetailsModal';
import { Hero } from '../types';
import { useTraining } from '../hooks/useTraining';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { registerTarget } from '../onboarding/targetRegistry';

export function TrainingScreen() {
  const { state, isLoaded, getHeroActions } = useTraining();

  const trainAtkRef = React.useRef<View>(null);
  React.useEffect(() => {
    return registerTarget('train-atk', () =>
      new Promise((resolve) => {
        const node = trainAtkRef.current as any;
        if (!node?.measureInWindow) return resolve(null);
        node.measureInWindow((x: number, y: number, width: number, height: number) =>
          resolve({ x, y, width, height })
        );
      })
    );
  }, []);

  const [selectedHero, setSelectedHero] = React.useState<Hero | null>(null);

  if (!isLoaded) {
    return <LoadingScreen message="Carregando treinamento..." />;
  }

  // O FTUE aponta para o ATK do primeiro herói da lista — é o gesto que o passo pede.
  const renderHero = ({ item, index }: { item: Hero; index: number }) => (
    <HeroCard
      hero={item}
      actions={getHeroActions(item, index === 0 ? trainAtkRef : undefined)}
      showSecondaryStats={false}
      onPress={setSelectedHero}
      equippedCosmetics={state.cosmetics?.equipped}
    />
  );

  return (
    <ScreenContainer
      scroll={false}
      banner={
        <Banner
          title="Campo de Treino"
          subtitle={`${state.heroes.length} herói${state.heroes.length !== 1 ? 's' : ''} em prontidão`}
          right={<AnimatedGold gold={state.gold} />}
        />
      }
    >
      {state.heroes.length === 0 ? (
        <EmptyState
          icon="castle"
          title="Campo de Treino Vazio"
          subtitle="Não há ninguém aqui para treinar. Recrute heróis na loja!"
        />
      ) : (
        <FlatList
          data={state.heroes}
          renderItem={renderHero}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <HeroDetailsModal
        visible={!!selectedHero}
        hero={selectedHero}
        onClose={() => setSelectedHero(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: theme.spacing.xl,
  },
});
