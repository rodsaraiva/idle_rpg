import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';
import { Banner } from './Banner';
import { Button } from './Button';
import { Card } from './Card';
import { Divider } from './Divider';
import { OrnateFrame } from './OrnateFrame';
import { Parchment } from './Parchment';
import { Seal } from './Seal';
import { Icon } from './Icon';
import { HPBar } from '../HPBar';
import { Rarity } from '../../theme/tokens/rarity';
import { ClassId } from '../../types';

const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const CLASSES: ClassId[] = ['WARRIOR', 'TANK', 'ROGUE', 'ARCHER', 'MAGE', 'HEALER'];

export function DesignSystemScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Banner title="Reino" subtitle="Vitrine do Design System" />

      <Text style={styles.section}>Botões</Text>
      <View style={styles.row}>
        <Button label="Ouro" variant="gold" onPress={() => {}} />
        <Button label="Madeira" variant="wood" onPress={() => {}} />
        <Button label="Perigo" variant="danger" icon="sword" onPress={() => {}} />
        <Button label="Fantasma" variant="ghost" onPress={() => {}} />
      </View>

      <Text style={styles.section}>Cards por raridade</Text>
      {RARITIES.map(r => (
        <Card key={r} rarity={r}>
          <Text style={styles.cardText}>{theme.rarity[r].label}</Text>
        </Card>
      ))}

      <Text style={styles.section}>Moldura</Text>
      <OrnateFrame>
        <Text style={styles.cardText}>OrnateFrame com cantos</Text>
      </OrnateFrame>

      <Text style={styles.section}>Selos de classe</Text>
      <View style={styles.row}>
        {CLASSES.map(c => <Seal key={c} kind={c} size={40} />)}
        <Seal kind="MAGE" size={40} locked />
      </View>

      <Divider variant="ornament" />

      <Text style={styles.section}>Ícones de stat + HP-bar</Text>
      <View style={styles.row}>
        <Icon name="stat-hp" /><Icon name="stat-atk" /><Icon name="stat-mp" /><Icon name="stat-def" />
      </View>
      <HPBar current={9} max={10} />
      <HPBar current={5} max={10} />
      <HPBar current={2} max={10} />

      <Parchment>
        <Text style={styles.cardText}>Pergaminho com textura</Text>
      </Parchment>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bgBase },
  content: { padding: theme.spacing.md, gap: theme.spacing.sm },
  section: { ...theme.type.h2, color: theme.colors.gold, marginTop: theme.spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, alignItems: 'center' },
  cardText: { ...theme.type.body, color: theme.colors.textPrimary },
});
