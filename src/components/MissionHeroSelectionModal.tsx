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
  onConfirm: (templateId: string, heroIds: string[]) => void;
};

export const MissionHeroSelectionModal: React.FC<Props> = ({
  visible,
  onClose,
  selectableHeroes,
  minHeroes,
  templateId,
  onConfirm,
}) => {
  // grid of 9 slots, each can hold a hero id or null
  const [slots, setSlots] = useState<(string | null)[]>(() => Array(9).fill(null));

  // reset slots when modal opens to provide fresh selection each time
  useEffect(() => {
    if (visible) setSlots(Array(9).fill(null));
  }, [visible]);

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
  const containerViewRef = useRef<View | null>(null);

  const placeHero = (heroId: string) => {
    // if already placed, remove it
    if (placedSet.has(heroId)) {
      setSlots((s) => s.map((v) => (v === heroId ? null : v)));
      return;
    }
    // find first empty slot
    const idx = slots.findIndex((s) => s === null);
    if (idx === -1) return;
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
    onConfirm(templateId, heroIds);
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

  // touch tracking to start drag on short touch+move (not only long-press)
  // Note: rely on longPress only for drag start to avoid responder conflicts

  // animated scale values per cell for hover effect
  const cellScalesRef = useRef<Animated.Value[]>(
    Array.from({ length: 9 }, () => new Animated.Value(1))
  ) as React.MutableRefObject<Animated.Value[]>;
  const [ghostSize, setGhostSize] = useState({ w: 100, h: 44 });
  useEffect(() => {
    const target = hoveredIndex === null ? -1 : hoveredIndex;
    cellScalesRef.current.forEach((av: Animated.Value, idx: number) => {
      Animated.timing(av, {
        toValue: idx === target ? 1.04 : 1,
        duration: 120,
        useNativeDriver: !IS_WEB,
      }).start();
    });
  }, [hoveredIndex]);

  // derive invalid placed heroes (missing or incapacitated)
  const invalidPlaced = useMemo(() => {
    const now = Date.now();
    return slots
      .filter(Boolean)
      .map((id) => id as string)
      .filter((id) => {
        const h = selectableHeroes.find((hh) => hh.id === id);
        if (!h) return true;
        if (h.incapacitatedUntilMs && h.incapacitatedUntilMs > now) return true;
        return false;
      });
  }, [slots, selectableHeroes]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent} scrollEnabled={!dragging}>
            <Text style={styles.title}>Posicione os heróis na missão</Text>
            {/* hidden ghost measurer so we know exact ghost size for cursor centering */}
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
              {slots.map((heroId, i) => {
                const hero = selectableHeroes.find((h) => h.id === heroId);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.cell, hero ? styles.cellFilled : styles.cellEmpty]}
                    onLayout={(e) => {
                      setCellLayout(i, e.nativeEvent.layout);
                    }}
                    onPress={() => {
                      if (hero) removeAt(i);
                    }}
                    // allow dragging a hero from a filled cell to another cell
                    delayLongPress={100}
                    onLongPress={(e) => {
                      if (!hero) return;
                      const ev = e.nativeEvent as any;
                      // start drag with hero from this cell
                      // @ts-ignore has pageX/pageY
                      startDrag({ ...hero }, ev.pageX ?? ev.locationX, ev.pageY ?? ev.locationY, ghostSize);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={hero ? `${hero.name}, posição ${i + 1}` : `Posição ${i + 1}, vazia`}
                  >
                    <Animated.View style={{ transform: [{ scale: cellScalesRef.current[i] }] }}>
                      {hero ? (
                        <>
                      <Text style={styles.cellEmoji}>{CLASS_EMOJI[hero.classId ?? ''] ?? '❓'}</Text>
                          <Text style={styles.cellTextSmall}>{hero.name}</Text>
                        </>
                      ) : (
                        <Text style={styles.cellText}>+</Text>
                      )}
                    </Animated.View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.subtitle}>Toque os heróis abaixo para preencher a matriz</Text>

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
                      // start drag using page coordinates and measured ghost size
                      const ev = e.nativeEvent as any;
                      // @ts-ignore has pageX/pageY
                      startDrag(item, ev.pageX ?? ev.locationX, ev.pageY ?? ev.locationY, ghostSize);
                    }}
                    // use longPress to start drag; avoid manual responder handlers to prevent conflicts
                    accessibilityRole="button"
                    accessibilityLabel={`Herói ${item.name}. Toque para posicionar ou pressione e arraste para mover.`}
                  >
                    <Text style={styles.heroEmojiSmall}>{CLASS_EMOJI[item.classId ?? ''] ?? '❓'}</Text>
                    <Text style={styles.heroName}>{item.name}</Text>
                    <Text style={styles.heroInfo}>
                      HP {Math.floor(item.hpCurrent)}/{Math.floor(item.hpMax)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            {/* ghost moved outside ScrollView for correct absolute positioning */}

            <View style={styles.actions}>
              <Text style={styles.helperText}>
                Selecionados: {placedCount} {minHeroes > 0 ? `(min ${minHeroes})` : ''}
              </Text>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ marginRight: 8 }}>
                  <Button title="Fechar" onPress={onClose} accessibilityLabel="Fechar modal de seleção" />
                </View>
                <Button
                  title="Iniciar missão"
                  onPress={handleConfirm}
                  disabled={placedCount < minHeroes || invalidPlaced.length > 0}
                  accessibilityLabel="Iniciar missão com heróis selecionados"
                />
              </View>
            </View>
            {invalidPlaced.length > 0 ? (
              <Text style={{ color: theme.colors.warning, marginTop: 8 }}>
                Alguns heróis selecionados não estão disponíveis (incapacitados ou removidos). Remova-os antes de iniciar.
              </Text>
            ) : null}
          </ScrollView>
        </View>

        {/* drag ghost rendered at backdrop level so absolute page coords align */}
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
  container: { width: '92%', backgroundColor: theme.colors.surface, borderRadius: 8, padding: 12 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: theme.colors.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 8 },
  cell: {
    width: '30%',
    aspectRatio: 1,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  cellEmpty: { backgroundColor: theme.colors.surfaceLight, borderWidth: 1, borderColor: theme.colors.border },
  cellFilled: { backgroundColor: theme.colors.primary, borderWidth: 0 },
  cellHover: { borderColor: theme.colors.accent, borderWidth: 2 },
  cellText: { color: theme.colors.textPrimary, textAlign: 'center' },
  subtitle: { color: theme.colors.textSecondary, marginBottom: 8 },
  heroItem: {
    backgroundColor: theme.colors.surfaceLight,
    padding: 8,
    marginRight: 8,
    borderRadius: 6,
    minWidth: 100,
  },
  heroItemPlaced: { opacity: 0.6 },
  heroName: { fontWeight: '600', color: theme.colors.textPrimary },
  heroInfo: { color: theme.colors.textSecondary },
  actions: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  helperText: { color: theme.colors.textSecondary, marginRight: 8, alignSelf: 'center' },
  dragGhost: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 100,
    height: 44,
    zIndex: 1000,
    elevation: 1000,
  },
  cellEmoji: { fontSize: 24, marginBottom: 4 },
  cellTextSmall: { color: theme.colors.textPrimary, fontSize: 12, textAlign: 'center' },
  heroEmojiSmall: { fontSize: 20, marginBottom: 4 },
  cellAccessible: {},
  warningText: { color: theme.colors.warning },
  cellAvatar: { width: 48, height: 48, borderRadius: 8, marginBottom: 6 },
  dragGhostStyle: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 6,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 4px 6px rgba(0,0,0,0.15)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
          elevation: 8,
        }),
  },
});

