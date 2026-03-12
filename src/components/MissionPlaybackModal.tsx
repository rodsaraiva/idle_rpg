import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { ActiveMission } from '../types';
import { theme } from '../theme';
import { 
  TOTAL_GRID_SLOTS, 
  GRID_COLUMNS, 
  GRID_ROWS,
  HEX_WIDTH,
  HEX_HEIGHT,
  HEX_VERTICAL_SPACING 
} from '../constants/game';
import { Hexagon } from './Hexagon';
import { useMissionPlayback } from '../hooks/useMissionPlayback';

const CLASS_EMOJI: Record<string, string> = {
  WARRIOR: '⚔️',
  TANK: '🛡️',
  ROGUE: '🗡️',
  ARCHER: '🏹',
  MAGE: '🔮',
  HEALER: '💚',
};

type Props = {
  visible: boolean;
  onClose: () => void;
  mission: ActiveMission | null;
};

export const MissionPlaybackModal: React.FC<Props> = ({
  visible,
  onClose,
  mission,
}) => {
  const { currentCombatants, playbackLog, isFinished } = useMissionPlayback(mission);

  const renderGrid = () => {
    const cells = [];
    for (let i = 0; i < TOTAL_GRID_SLOTS; i++) {
      const row = Math.floor(i / GRID_COLUMNS);
      const combatant = currentCombatants.find(c => c.position === i && c.alive);
      
      cells.push(
        <View
          key={i}
          style={[
            styles.cell,
            {
              position: 'absolute',
              left: (i % GRID_COLUMNS) * HEX_WIDTH + ((row % 2) * HEX_WIDTH) / 2,
              top: row * HEX_VERTICAL_SPACING,
            },
          ]}
        >
          <Hexagon
            fill={combatant ? (combatant.type === 'hero' ? theme.colors.primary : theme.colors.hp) : theme.colors.surfaceLight}
            stroke={theme.colors.border}
            strokeWidth={1}
          >
            {combatant && (
              <View style={styles.combatantContainer}>
                <Text style={styles.cellEmoji}>
                  {combatant.type === 'hero' ? (CLASS_EMOJI[combatant.classId ?? ''] ?? '👤') : '👹'}
                </Text>
                <View style={styles.hpBarContainer}>
                    <View style={[styles.hpBarFill, { width: `${(combatant.hp / combatant.maxHp) * 100}%` }]} />
                </View>
              </View>
            )}
          </Hexagon>
        </View>
      );
    }
    return cells;
  };

  if (!mission) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.backdrop}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Assistindo Missão</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Sair</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.gridContainer}>
                <View style={styles.grid}>
                    {renderGrid()}
                </View>
            </View>

            <View style={styles.logSection}>
              <Text style={styles.logTitle}>Diário de Batalha</Text>
              <View style={styles.logContainer}>
                {playbackLog.map((log, idx) => (
                  <Text key={idx} style={styles.logText}>• {log}</Text>
                ))}
              </View>
            </View>

            {isFinished && (
              <View style={styles.finishedBadge}>
                <Text style={styles.finishedText}>Missão Concluída!</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '95%',
    height: '90%',
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  closeButton: {
    padding: 8,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 8,
  },
  closeButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    alignItems: 'center',
  },
  gridContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  grid: {
    width: (GRID_COLUMNS + 0.5) * HEX_WIDTH,
    height: GRID_ROWS * HEX_VERTICAL_SPACING + HEX_HEIGHT / 2,
  },
  cell: {
    width: HEX_WIDTH,
    height: HEX_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  combatantContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  hpBarContainer: {
    width: 30,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  hpBarFill: {
    height: '100%',
    backgroundColor: theme.colors.hp,
  },
  logSection: {
    width: '100%',
    marginTop: 16,
  },
  logTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  logContainer: {
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 120,
  },
  logText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  finishedBadge: {
    marginTop: 20,
    padding: 12,
    backgroundColor: theme.colors.success,
    borderRadius: 8,
  },
  finishedText: {
    color: 'white',
    fontWeight: 'bold',
  }
});
