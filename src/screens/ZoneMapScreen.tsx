import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useGame } from '../hooks/useGame';
import { theme } from '../theme';
import { ScreenContainer } from '../components/ui/ScreenContainer';
import { Banner } from '../components/ui/Banner';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { EventBanner } from '../components/EventBanner';
import { zoneStatus, ZoneId } from '../utils/zoneUtils';

// re-exporta para conveniência de quem importar daqui
export { zoneStatus } from '../utils/zoneUtils';
export type { ZoneId, ZoneUnlockStatus, ZoneStatusMap } from '../utils/zoneUtils';

// ── Metadados de zona para exibição ──────────────────────────────────────────

interface ZoneMeta {
  id: ZoneId;
  name: string;
  icon: string;
  difficultyRange: string;
  unlockHint: string;
}

const ZONE_META: ZoneMeta[] = [
  {
    id: 'z1',
    name: 'Zona 1 — Terras Iniciais',
    icon: '🏕️',
    difficultyRange: '1–5',
    unlockHint: 'Sempre acessível',
  },
  {
    id: 'z2',
    name: 'Zona 2 — Costa dos Ventos',
    icon: '🌊',
    difficultyRange: '6–7',
    unlockHint: 'Derrote o Dragão (missão boss 1)',
  },
  {
    id: 'z3',
    name: 'Zona 3 — Picos Gelados',
    icon: '🏔️',
    difficultyRange: '8–9',
    unlockHint: 'Derrote o Capitão da Costa (z2_costa_2)',
  },
  {
    id: 'z4',
    name: 'Zona 4 — Abismo Eterno',
    icon: '🌑',
    difficultyRange: '9–10',
    unlockHint: 'Sobreviva à Tempestade Glacial (z3_picos_2)',
  },
];

// ── Componente ────────────────────────────────────────────────────────────────

export function ZoneMapScreen() {
  const { state } = useGame();
  const nav = useNavigation<any>();
  const zones = zoneStatus(state);

  return (
    <ScreenContainer
      banner={
        <Banner
          title="Mapa de Zonas"
          subtitle="Explore novos territórios"
        />
      }
    >
      <View style={styles.content}>
        {/* Banner de evento ativo */}
        <EventBanner state={state} />

        {/* Lista de zonas */}
        {ZONE_META.map(zone => {
          const status = zones[zone.id];
          const isLocked = status === 'locked';

          return (
            <Card key={zone.id} elevation="e1">
              <View style={styles.zoneRow}>
                <Text style={styles.zoneIcon}>{zone.icon}</Text>
                <View style={styles.zoneInfo}>
                  <Text
                    style={[styles.zoneName, isLocked && styles.zoneNameLocked]}
                  >
                    {zone.name}
                  </Text>
                  <Text style={styles.zoneDiff}>
                    Dificuldade {zone.difficultyRange}
                  </Text>
                  {isLocked && (
                    <Text style={styles.lockHint}>{zone.unlockHint}</Text>
                  )}
                </View>
                <View style={styles.zoneStatus}>
                  {isLocked ? (
                    <Icon name="skull" size={20} color={theme.colors.textMuted} />
                  ) : (
                    <Icon name="check" size={20} color={theme.colors.success} />
                  )}
                  <Text
                    style={[
                      styles.statusLabel,
                      isLocked ? styles.statusLocked : styles.statusUnlocked,
                    ]}
                  >
                    {isLocked ? 'Bloqueada' : 'Acessível'}
                  </Text>
                </View>
              </View>

              {!isLocked && (
                <TouchableOpacity
                  style={styles.missionBtn}
                  onPress={() => nav.navigate('Missões')}
                  activeOpacity={0.8}
                >
                  <Icon name="map-marker-path" size={16} color={theme.colors.bgDeep} />
                  <Text style={styles.missionBtnText}>Ver Missões</Text>
                </TouchableOpacity>
              )}
            </Card>
          );
        })}
      </View>
    </ScreenContainer>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  zoneIcon: {
    fontSize: 32,
    marginTop: 2,
  },
  zoneInfo: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  zoneName: {
    ...theme.type.h2,
    color: theme.colors.textPrimary,
  },
  zoneNameLocked: {
    color: theme.colors.textMuted,
  },
  zoneDiff: {
    ...theme.type.label,
    color: theme.colors.textSecondary,
  },
  lockHint: {
    ...theme.type.caption,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  zoneStatus: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    minWidth: 70,
  },
  statusLabel: {
    ...theme.type.caption,
    textAlign: 'center',
  },
  statusLocked: {
    color: theme.colors.textMuted,
  },
  statusUnlocked: {
    color: theme.colors.success,
  },
  missionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.gold,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  missionBtnText: {
    ...theme.type.label,
    color: theme.colors.bgDeep,
  },
});
