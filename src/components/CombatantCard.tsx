import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Platform, Animated, Easing } from 'react-native';
import { theme } from '../theme';
import { on } from '../services/feedback';

interface CombatantCardProps {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  atk?: number;
  mp?: number;
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
  avatarUrl,
  attackType,
  align = 'left',
  highlighted = false,
}) => {
  const hpPct = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));

  const hpAnim = useRef(new Animated.Value(hpPct)).current;
  const hitAnim = useRef(new Animated.Value(0)).current; // 0..1
  const deathAnim = useRef(new Animated.Value(hp > 0 ? 1 : 0)).current; // opacity/scale
  const [dmgText, setDmgText] = useState<string | null>(null);
  const dmgAnim = useRef(new Animated.Value(0)).current;
  const [isTargetLocal, setIsTargetLocal] = useState(false);

  // animate HP bar when hp changes
  useEffect(() => {
    const to = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
    Animated.timing(hpAnim, {
      toValue: to,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false, // animating width/scaleX; width can't use native driver reliably
    }).start();
  }, [hp, maxHp, hpAnim]);

  // listen for global hit/death events for this combatant
  useEffect(() => {
    function onHit(p: any) {
      if (!p || p.id !== id) return;
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
    function onDeath(p: any) {
      if (!p || p.id !== id) return;
      Animated.timing(deathAnim, { toValue: 0, duration: 360, useNativeDriver: true }).start();
    }
    function onTarget(p: any) {
      if (!p || p.id !== id) return;
      setIsTargetLocal(true);
      const t = p.duration ?? 800;
      setTimeout(() => setIsTargetLocal(false), t);
    }
    const unsubHit = on('BATTLE_HIT', onHit);
    const unsubDeath = on('BATTLE_DEATH', onDeath);
    const unsubTarget = on('BATTLE_TARGET', onTarget);
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
  const dmgTranslate = dmgAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const dmgOpacity = dmgAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 0] });

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
            <Animated.View style={[styles.hpFill, { width: hpWidth, backgroundColor: hpPct > 0.6 ? '#3CB371' : hpPct > 0.3 ? '#FFD24D' : '#FF7A7A' }]} />
            <Text style={styles.hpOverlayText}>{Math.floor(hp)}/{Math.floor(maxHp)}</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          {typeof atk === 'number' ? <Text style={styles.metaText}>ATK {Math.floor(atk)}</Text> : null}
          {typeof mp === 'number' ? <Text style={styles.metaText}>MP {Math.floor(mp)}</Text> : null}
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
    borderColor: theme.colors.surfaceLight,
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
    backgroundColor: theme.colors.surfaceLight,
  },
  info: {
    flex: 1,
  },
  name: {
    color: theme.colors.textPrimary,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: 4,
  },
  hpColumn: {
    flexDirection: 'column',
    width: '100%',
  },
  hpBarContainer: {
    width: '100%',
    height: 16,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 4,
  },
  hpFill: {
    height: '100%',
    backgroundColor: theme.colors.hp,
  },
  hpOverlayText: {
    position: 'absolute',
    alignSelf: 'center',
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 6,
    alignItems: 'center',
    gap: 8,
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
    borderWidth: 1,
    borderColor: theme.colors.primary,
    ...Platform.select({
      web: {
        boxShadow: `0 0 8px ${theme.colors.primary}`,
      },
      default: {
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
      },
    }),
  },
  hitOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ff7a7a',
    borderRadius: theme.borderRadius.sm,
    opacity: 0,
  },
  dmgFloat: {
    position: 'absolute',
    top: -22,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  dmgText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ff7a7a',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
