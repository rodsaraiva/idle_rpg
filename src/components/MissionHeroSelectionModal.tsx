import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Button,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { useDragDropGrid } from '../hooks/useDragDropGrid';
import { Hero } from '../types';
import { theme } from '../theme';
import { 
  TOTAL_GRID_SLOTS, 
  GRID_COLUMNS, 
  GRID_ROWS,
  ENEMY_ROWS, 
  HERO_ROWS,
  HEX_WIDTH,
  HEX_HEIGHT,
  HEX_VERTICAL_SPACING,
  INCAPACITATED_HP_THRESHOLD
} from '../constants/game';
import { MISSIONS } from '../constants/missions';
import { BattleEngine, BattleEnemy } from '../utils/battleEngine';
import { getActiveSynergies } from '../constants/synergies';
import { PERSONALITIES } from '../constants/personalities';
import { ClassId } from '../types';

import { Hexagon } from './Hexagon';

const IS_WEB = Platform.OS === 'web';

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
  selectableHeroes: Hero[];
  minHeroes: number;
  templateId: string;
  onConfirm: (templateId: string, heroIds: string[], heroPositions: Record<string, number>, looping?: boolean) => void;
};

export const MissionHeroSelectionModal: React.FC<Props> = ({
  visible,
  onClose,
  selectableHeroes,
  minHeroes,
  templateId,
  onConfirm,
}) => {
  // grid of 50 slots, each can hold a hero id or null
  const [slots, setSlots] = useState<(string | null)[]>(() => Array(TOTAL_GRID_SLOTS).fill(null));
  const [previewEnemies, setPreviewEnemies] = useState<BattleEnemy[]>([]);
  const [looping, setLooping] = useState(false);

  // reset slots and generate preview enemies when modal opens
  useEffect(() => {
    if (visible) {
      setSlots(Array(TOTAL_GRID_SLOTS).fill(null));
      setLooping(false);
      const template = MISSIONS.find(t => t.id === templateId);
      if (template) {
        setPreviewEnemies(BattleEngine.createEnemies(template));
      } else {
        setPreviewEnemies([]);
      }
    }
  }, [visible, templateId]);

  // keep slots in sync if selectableHeroes change (remove heroes that no longer exist)
  useEffect(() => {
    setSlots((prev) => {
      const validIds = new Set(selectableHeroes.map((h) => h.id));
      let changed = false;
      const next = prev.map((v) => {
        if (v && !validIds.has(v)) {
          changed = true;
          return null;
        }
        return v;
      });
      return changed ? next : prev;
    });
  }, [selectableHeroes]);

  const placedSet = useMemo(() => new Set(slots.filter(Boolean) as string[]), [slots]);

  const previewSynergies = useMemo(() => {
    const placedHeroes = selectableHeroes.filter((h) => placedSet.has(h.id));
    const classIds = placedHeroes.map((h) => h.classId).filter(Boolean) as ClassId[];
    return getActiveSynergies(classIds);
  }, [placedSet, selectableHeroes]);
  const containerViewRef = useRef<View | null>(null);

  const placeHero = (heroId: string) => {
    // if already placed, remove it
    if (placedSet.has(heroId)) {
      setSlots((s) => s.map((v) => (v === heroId ? null : v)));
      return;
    }
    // find first empty slot in HERO_ROWS
    const heroIndices = HERO_ROWS.flatMap(r => 
      Array.from({ length: GRID_COLUMNS }, (_, c) => r * GRID_COLUMNS + c)
    );
    const idx = heroIndices.find(i => slots[i] === null);
    if (idx === undefined) return;

    setSlots((s) => {
      const next = [...s];
      next[idx] = heroId;
      return next;
    });
  };

  const removeAt = (index: number) => {
    setSlots((s) => {
      const next = [...s];
      next[index] = null;
      return next;
    });
  };

  const placedCount = slots.filter(Boolean).length;

  const handleConfirm = () => {
    const heroIds = slots.filter(Boolean) as string[];
    if (heroIds.length < minHeroes) return;

    const heroPositions: Record<string, number> = {};
    slots.forEach((id, idx) => {
      if (id) heroPositions[id] = idx;
    });

    onConfirm(templateId, heroIds, heroPositions, looping);
  };

  // drag/drop logic delegated to hook for testability/clarity
  const {
    pan,
    dragging,
    draggingItem,
    startDrag,
    cancelDrag,
    panHandlers,
    setContainerRef,
    setCellLayout,
    hoveredIndex,
  } = useDragDropGrid<Hero>((item, droppedIndex) => {
    // Check if dropped index is in HERO_ROWS
    const row = Math.floor(droppedIndex / GRID_COLUMNS);
    if (!HERO_ROWS.includes(row)) {
      return;
    }

    setSlots((s) => {
      const next = [...s];
      // find source index where this item currently sits (may be -1 if not placed)
      const srcIndex = next.findIndex((v) => v === item.id);
      const targetId = next[droppedIndex];
      if (srcIndex === -1) {
        // not previously placed: place into target (swap behavior not applicable)
        next[droppedIndex] = item.id;
      } else if (targetId == null) {
        // move to empty target
        next[srcIndex] = null;
        next[droppedIndex] = item.id;
      } else {
        // swap src and target
        next[srcIndex] = targetId;
        next[droppedIndex] = item.id;
      }
      return next;
    });
    // small bounce animation for target cell to give tactile feedback
    try {
      const av: Animated.Value = cellScalesRef.current[droppedIndex];
      if (av) {
        Animated.sequence([
          Animated.timing(av, { toValue: 1.12, duration: 120, useNativeDriver: !IS_WEB }),
          Animated.spring(av, { toValue: 1, friction: 6, useNativeDriver: !IS_WEB }),
        ]).start();
      }
    } catch {
      /* non-critical */
    }
  });

  // animated scale values per cell for hover effect
  const cellScalesRef = useRef<Animated.Value[]>(
    Array.from({ length: TOTAL_GRID_SLOTS }, () => new Animated.Value(1))
  ) as React.MutableRefObject<Animated.Value[]>;

  const [ghostSize, setGhostSize] = useState({ w: 100, h: 44 });

  useEffect(() => {
    const target = hoveredIndex === null ? -1 : hoveredIndex;
    cellScalesRef.current.forEach((av: Animated.Value, idx: number) => {
      if (!av) return;
      Animated.timing(av, {
        toValue: idx === target ? 1.04 : 1,
        duration: 120,
        useNativeDriver: !IS_WEB,
      }).start();
    });
  }, [hoveredIndex]);

  // derive invalid placed heroes (missing or incapacitated)
  const invalidPlaced = useMemo(() => {
    return slots
      .filter(Boolean)
      .map((id) => id as string)
      .filter((id) => {
        const h = selectableHeroes.find((hh) => hh.id === id);
        if (!h) return true;
        if (h.hpCurrent < INCAPACITATED_HP_THRESHOLD) return true;
        return false;
      });
  }, [slots, selectableHeroes]);

  const renderCell = (i: number) => {
    const heroId = slots[i];
    const hero = selectableHeroes.find((h) => h.id === heroId);
    const enemy = previewEnemies.find(e => e.position === i);
    const row = Math.floor(i / GRID_COLUMNS);
    const isHeroRow = HERO_ROWS.includes(row);
    const isEnemyRow = ENEMY_ROWS.includes(row);

    const cellStyle = [
      styles.cell,
      {
        position: 'absolute',
        left: (i % GRID_COLUMNS) * HEX_WIDTH + ((row % 2) * HEX_WIDTH) / 2,
        top: row * HEX_VERTICAL_SPACING,
      },
      hero && styles.cellFilled,
    ];

    return (
      <TouchableOpacity
        key={i}
        style={cellStyle}
        onLayout={(e) => {
          setCellLayout(i, e.nativeEvent.layout);
        }}
        onPress={() => {
          if (hero) removeAt(i);
        }}
        disabled={!isHeroRow && !hero}
        delayLongPress={0}
        onLongPress={(e) => {
          if (!hero) return;
          const ev = e.nativeEvent as any;
          startDrag({ ...hero }, ev.pageX ?? ev.locationX, ev.pageY ?? ev.locationY, ghostSize);
        }}
        accessibilityRole="button"
        accessibilityLabel={hero ? `${hero.name}, posição ${i + 1}` : `Posição ${i + 1}, vazia`}
      >
        <Animated.View style={{ transform: [{ scale: cellScalesRef.current[i] }] }}>
          <Hexagon
            fill={
              hero
                ? theme.colors.primary
                : enemy
                ? 'rgba(255, 0, 0, 0.3)'
                : isHeroRow
                ? 'rgba(100, 149, 237, 0.15)'
                : isEnemyRow
                ? 'rgba(255, 0, 0, 0.05)'
                : theme.colors.surfaceLight
            }
            stroke={
              isHeroRow && !hero ? '#6495ed' : theme.colors.border
            }
            strokeWidth={isHeroRow && !hero ? 1 : 1}
          >
            {hero ? (
              <>
                <Text style={styles.cellEmoji}>{CLASS_EMOJI[hero.classId ?? ''] ?? '❓'}</Text>
                <Text style={styles.cellTextSmall}>{hero.name}</Text>
              </>
            ) : enemy ? (
              <>
                <Text style={styles.cellEmoji}>👹</Text>
                <Text style={styles.cellTextEnemy}>Inimigo</Text>
              </>
            ) : isHeroRow ? (
              <Text style={styles.cellText}>+</Text>
            ) : null}
          </Hexagon>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent} scrollEnabled={!dragging}>
            <Text style={styles.title}>Posicione os heróis na missão</Text>
            
            <View
              style={{ position: 'absolute', left: -9999, top: -9999, opacity: 0 }}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                if (width && height) setGhostSize({ w: width, h: height });
              }}
            >
              <View style={[styles.dragGhostStyle, { width: 100, height: 44 }]}>
                <Text style={styles.heroEmojiSmall}>❓</Text>
                <Text style={styles.heroName}>Measure</Text>
              </View>
            </View>

            <View
              ref={(r) => {
                containerViewRef.current = r;
                setContainerRef(r);
              }}
              onLayout={() => {
                setContainerRef(containerViewRef.current);
              }}
              style={styles.grid}
              {...panHandlers}
            >
              {Array.from({ length: TOTAL_GRID_SLOTS }, (_, i) => renderCell(i))}
            </View>

            <Text style={styles.subtitle}>Arraste os heróis para a zona azul (3 linhas de baixo)</Text>

            <FlatList
              data={selectableHeroes}
              horizontal
              keyExtractor={(h) => h.id}
              contentContainerStyle={{ paddingVertical: 8 }}
              scrollEnabled={!dragging}
              renderItem={({ item }) => {
                const placed = placedSet.has(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.heroItem, placed && styles.heroItemPlaced]}
                    onPress={() => placeHero(item.id)}
                    delayLongPress={0}
                    onLongPress={(e) => {
                      const ev = e.nativeEvent as any;
                      startDrag(item, ev.pageX ?? ev.locationX, ev.pageY ?? ev.locationY, ghostSize);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Herói ${item.name}. Toque para posicionar ou pressione e arraste para mover.`}
                  >
                    <Text style={styles.heroEmojiSmall}>{CLASS_EMOJI[item.classId ?? ''] ?? '❓'}</Text>
                    <Text style={styles.heroName}>
                      {item.personality && PERSONALITIES[item.personality] ? `${PERSONALITIES[item.personality].emoji} ` : ''}{item.name}
                    </Text>
                    <Text style={styles.heroInfo}>
                      HP {Math.floor(item.hpCurrent)}/{Math.floor(item.hpMax)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            {previewSynergies.length > 0 && (
              <View style={styles.synergiesPreview}>
                <Text style={styles.synergiesTitle}>Sinergias Ativas</Text>
                <View style={styles.synergiesList}>
                  {previewSynergies.map((s) => (
                    <View key={s.name} style={styles.synergyPreviewBadge}>
                      <Text style={styles.synergyPreviewName}>{s.name}</Text>
                      <Text style={styles.synergyPreviewDesc}>{s.description}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.loopToggle}
              onPress={() => setLooping((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: looping }}
              accessibilityLabel="Alternar modo loop da missão"
            >
              <View style={[styles.loopCheckbox, looping && styles.loopCheckboxActive]}>
                {looping ? <Text style={styles.loopCheckmark}>✓</Text> : null}
              </View>
              <Text style={styles.loopLabel}>Em Loop (auto-repetir missão)</Text>
            </TouchableOpacity>

            <View style={styles.actions}>
              <Text style={styles.helperText}>
                Selecionados: {placedCount} {minHeroes > 0 ? `(min ${minHeroes})` : ''}
              </Text>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ marginRight: 8 }}>
                  <Button title="Fechar" onPress={onClose} accessibilityLabel="Fechar modal de seleção" />
                </View>
                <Button
                  title={looping ? "Iniciar em loop" : "Iniciar missão"}
                  onPress={handleConfirm}
                  disabled={placedCount < minHeroes || invalidPlaced.length > 0}
                  accessibilityLabel={looping ? "Iniciar missão em loop" : "Iniciar missão com heróis selecionados"}
                />
              </View>
            </View>
            {invalidPlaced.length > 0 ? (
              <Text style={{ color: theme.colors.warning, marginTop: 8 }}>
                Alguns heróis selecionados não estão disponíveis. Remova-os antes de iniciar.
              </Text>
            ) : null}
          </ScrollView>
        </View>

        {dragging && draggingItem ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.dragGhost,
              {
                transform: [{ translateX: pan.x }, { translateY: pan.y }],
              },
            ]}
          >
            <Animated.View style={[styles.dragGhostStyle]}>
              <Text style={styles.heroEmojiSmall}>{CLASS_EMOJI[draggingItem.classId ?? ''] ?? '❓'}</Text>
              <Text style={styles.heroName}>{draggingItem.name}</Text>
            </Animated.View>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  container: { width: '98%', backgroundColor: theme.colors.surface, borderRadius: 8, padding: 4, maxHeight: '95%' },
  scrollContent: { paddingBottom: 20 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: theme.colors.textPrimary, textAlign: 'center' },
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'center', 
    marginBottom: 8,
    width: '100%',
    height: GRID_ROWS * HEX_VERTICAL_SPACING + HEX_HEIGHT / 4,
  },
  cell: {
    width: HEX_WIDTH,
    height: HEX_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellEmpty: { backgroundColor: theme.colors.surfaceLight, borderWidth: 1, borderColor: theme.colors.border },
  cellFilled: { backgroundColor: theme.colors.primary, borderWidth: 0 },
  cellHeroRow: { backgroundColor: 'rgba(100, 149, 237, 0.15)', borderColor: '#6495ed', borderStyle: 'dashed' },
  cellEnemyRow: { backgroundColor: 'rgba(255, 0, 0, 0.05)', borderColor: 'transparent' },
  cellEnemyFilled: { backgroundColor: 'rgba(255, 0, 0, 0.3)', borderWidth: 0 },
  cellHover: { borderColor: theme.colors.accent, borderWidth: 2 },
  cellText: { color: theme.colors.textSecondary, fontSize: 16, opacity: 0.5 },
  cellTextSmall: { color: theme.colors.textPrimary, fontSize: 8, textAlign: 'center' },
  cellTextEnemy: { color: '#ff4d4d', fontSize: 8, textAlign: 'center', fontWeight: 'bold' },
  subtitle: { color: theme.colors.textSecondary, marginBottom: 8, textAlign: 'center', fontSize: 12 },
  heroItem: {
    backgroundColor: theme.colors.surfaceLight,
    padding: 8,
    marginRight: 8,
    borderRadius: 6,
    minWidth: 80,
  },
  heroItemPlaced: { opacity: 0.6 },
  heroName: { fontWeight: '600', color: theme.colors.textPrimary, fontSize: 12 },
  heroInfo: { color: theme.colors.textSecondary, fontSize: 10 },
  actions: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  helperText: { color: theme.colors.textSecondary, marginRight: 8, alignSelf: 'center', fontSize: 12 },
  dragGhost: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 100,
    height: 44,
    zIndex: 1000,
    elevation: 1000,
  },
  cellEmoji: { fontSize: 16, marginBottom: 2 },
  heroEmojiSmall: { fontSize: 18, marginBottom: 2 },
  dragGhostStyle: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 6,
    boxShadow: '0px 4px 6px rgba(0,0,0,0.15)',
    elevation: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  synergiesPreview: {
    marginTop: 8,
    marginBottom: 4,
    padding: 8,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  synergiesTitle: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  synergiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  synergyPreviewBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  synergyPreviewName: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  synergyPreviewDesc: {
    color: 'rgba(248, 250, 252, 0.75)',
    fontSize: 9,
  },
  loopToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 2,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  loopCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  loopCheckboxActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  loopCheckmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loopLabel: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
});

