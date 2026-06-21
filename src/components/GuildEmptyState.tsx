import React from 'react';
import { EmptyState } from './ui/EmptyState';

export function GuildEmptyState() {
  return (
    <EmptyState
      icon="castle"
      title="Sua guilda está vazia"
      subtitle="Recrute seu primeiro herói para começar a aventura!"
    />
  );
}
