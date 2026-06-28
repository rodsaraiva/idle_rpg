import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Animated, Easing } from 'react-native';
import { theme } from '../theme';
import { textShadow } from '../theme/elevation';
import { on, FeedbackEvent } from '../services/feedback';
import { Icon } from './ui/Icon';
import { clamp01 } from '../utils/math';

interface CombatantCardProps {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  atk?: number;
  mp?: number;
  defense?: number;
  agility?: number;
  crit?: number;
  avatarUrl?: string;
  attackType?: 'MELEE' | 'RANGED';
  align?: 'left' | 'right';
  highlighted?: boolean;
}

export const CombatantCard: React.FC<CombatantCardProps> = ({
  id,
  name,
  hp,
  maxHp,
  atk,
  mp,
  defense,
  agility: _agility,
  crit: _crit,
  avatarUrl,
  attackType,
  align = 'left',
  highlighted = false,
}) => {
  const hpPct = clamp01(hp / Math.max(1, maxHp));

  const hpAnim = useRef(new Animated.Value(hpPct)).current;
  const hitAnim = useRef(new Animated.Value(0)).current; // 0..1
  const deathAnim = useRef(new Animated.Value(hp > 0 ? 1 : 0)).current; // opacity/scale
  const [dmgText, setDmgText] = useState<string | null>(null);
  const dmgAnim = useRef(new Animated.Value(0)).current;
  const [isTargetLocal, setIsTargetLocal] = useState(false);

  // animate HP bar when hp changes
  useEffect(() => {
    const to = clamp01(hp / Math.max(1, maxHp));
    Animated.timing(hpAnim, {
      toValue: to,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false, // animating width/scaleX; width can't use native driver reliably
    }).start();
  }, [hp, maxHp, hpAnim]);

  // listen for global hit/death events for this combatant
  useEffect(() => {
    function onHit(p: { id: string; amount: number }) {
      if (p.id !== id) return;
      // trigger quick hit pulse + shake
      hitAnim.setValue(0);
      // show floating damage if provided
      if (p.amount !== undefined && p.amount !== null) {
        setDmgText(`${p.amount > 0 ? '-' : ''}${p.amount}`);
        dmgAnim.setValue(0);
        Animated.timing(dmgAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          setDmgText(null);
          dmgAnim.setValue(0);
        });
      }
      Animated.sequence([
        Animated.timing(hitAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(hitAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }
    function onDeath(p: { id: string }) {
      if (p.id !== id) return;
      Animated.timing(deathAnim, { toValue: 0, duration: 360, useNativeDriver: true }).start();
    }
    function onTarget(p: { id: string; duration?: number }) {
      if (p.id !== id) return;
      setIsTargetLocal(true);
      const t = p.duration ?? 800;
      setTimeout(() => setIsTargetLocal(false), t);
    }
    const unsubHit = on(FeedbackEvent.BATTLE_HIT, onHit);
    const unsubDeath = on(FeedbackEvent.BATTLE_DEATH, onDeath);
    const unsubTarget = on(FeedbackEvent.BATTLE_TARGET, onTarget);
    return () => {
      unsubHit();
      unsubDeath();
      unsubTarget();
    };
  }, [id, hitAnim, deathAnim]);

  // derived animated styles
  const translateX = hitAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -6, 0] });
  const overlayOpacity = hitAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.5, 0] });
  const scale = deathAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  const hpWidth = hpAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const dmgTranslate = dmgAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });
  const dmgOpacity = dmgAnim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] });
  return (
    <Animated.View
      style={[
        styles.card,
        (highlighted || isTargetLocal) ? styles.highlight : null,
        align === 'right' ? styles.alignRight : styles.alignLeft,
        { transform: [{ translateX }, { scale }] },
      ]}
    >
      {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatar} /> : null}
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <View style={styles.hpColumn}>
          <View
            style={styles.hpBarContainer}
            accessible
            accessibilityLabel={`${name} HP ${Math.floor(hp)}/${Math.floor(maxHp)}`}
          >
            <Animated.View style={[styles.hpFill, { width: hpWidth, backgroundColor: hpPct > 0.6 ? theme.colors.hpHigh : hpPct > 0.3 ? theme.colors.hpMid : theme.colors.hpLow }]} />
            <Text style={styles.hpOverlayText}>{Math.floor(hp)}/{Math.floor(maxHp)}</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          {typeof atk === 'number' ? (
            <View style={styles.metaItem}><Icon name="stat-atk" size={11} color={theme.colors.textSecondary} /><Text style={styles.metaText}>{Math.floor(atk)}</Text></View>
          ) : null}
          {typeof mp === 'number' ? (
            <View style={styles.metaItem}><Icon name="stat-mp" size={11} color={theme.colors.textSecondary} /><Text style={styles.metaText}>{Math.floor(mp)}</Text></View>
          ) : null}
          {typeof defense === 'number' ? (
            <View style={styles.metaItem}><Icon name="stat-def" size={11} color={theme.colors.textSecondary} /><Text style={styles.metaText}>{Math.floor(defense)}</Text></View>
          ) : null}
          {attackType ? <Text style={styles.typeText}>{attackType === 'RANGED' ? 'R' : 'M'}</Text> : null}
        </View>
      </View>
      {/* hit overlay */}
      <Animated.View pointerEvents="none" style={[styles.hitOverlay, { opacity: overlayOpacity }]} />
      {/* floating damage near this combatant */}
      {dmgText ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.dmgFloat,
            {
              transform: [{ translateY: dmgTranslate }],
              opacity: dmgOpacity,
            },
          ]}
        >
          <Text style={styles.dmgText}>{dmgText}</Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.sm,
    minWidth: 120,
    maxWidth: 220,
    borderWidth: 1,
    borderColor: theme.colors.surfaceRaised,
    flexDirection: 'row',
    alignItems: 'center',
  },
  alignLeft: {
    alignSelf: 'flex-start',
  },
  alignRight: {
    alignSelf: 'flex-end',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceRaised,
  },
  info: {
    flex: 1,
  },
  name: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    marginBottom: 4,
  },
  hpColumn: {
    flexDirection: 'column',
    width: '100%',
  },
  hpBarContainer: {
    width: '100%',
    height: 16,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 4,
  },
  hpFill: {
    height: '100%',
    backgroundColor: theme.colors.statHp,
  },
  hpOverlayText: {
    position: 'absolute',
    alignSelf: 'center',
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 12,
    ...textShadow('rgba(0,0,0,0.45)', 0, 1, 2),
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 6,
    alignItems: 'center',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  typeText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginLeft: 4,
  },
  highlight: {
    borderColor: theme.colors.gold,
    borderWidth: 2,
    backgroundColor: theme.colors.surface,
  },
  hitOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.danger,
    borderRadius: theme.borderRadius.sm,
    opacity: 0,
    zIndex: 10,
  },
  dmgFloat: {
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  dmgText: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.danger,
    ...textShadow('rgba(0,0,0,0.5)', 0, 2, 3),
  },
});
