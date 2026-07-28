import React from 'react';
import { useGame } from '../hooks/useGame';
import { OfflineSummaryModal } from './OfflineSummaryModal';

/**
 * Monta o resumo offline na raiz do app.
 * Enquanto o modal vivia só na GuildScreen, o app abria na Vila e o ganho offline
 * quase nunca era creditado — o jogador teria que passar pela Guilda antes.
 */
export function OfflineSummaryGate(): React.ReactElement | null {
  const { offlineSummary, applyOfflineSummary, clearOfflineSummary } = useGame();
  if (!offlineSummary) return null;

  return (
    <OfflineSummaryModal
      visible
      summary={offlineSummary}
      onApply={applyOfflineSummary}
      onDismiss={clearOfflineSummary}
    />
  );
}
