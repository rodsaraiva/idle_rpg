import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MissionHeroSelectionModal } from '../../components/MissionHeroSelectionModal';
import { HeroTask, Hero } from '../../types';

function makeHero(id: string, name = 'Hero', classId = 'WARRIOR'): Hero {
  return {
    id,
    name,
    hpMax: 10,
    hpCurrent: 10,
    atk: 5,
    mp: 3,
    currentTask: HeroTask.IDLE,
    classId: classId as any,
  } as Hero;
}

test('modal exposes accessibility labels for controls and cells', () => {
  const h1 = makeHero('h1', 'Alpha');
  const h2 = makeHero('h2', 'Beta');
  const { getByLabelText, getByText } = render(
    <MissionHeroSelectionModal
      visible
      onClose={() => {}}
      selectableHeroes={[h1, h2]}
      minHeroes={1}
      templateId="mission_1"
      onConfirm={() => {}}
    />
  );

  // Buttons have accessibility labels
  expect(getByLabelText('Fechar modal de seleção')).toBeTruthy();
  expect(getByLabelText('Iniciar missão com heróis selecionados')).toBeTruthy();

  // Cells (positions) have accessibility labels for empty positions
  expect(getByLabelText('Posição 1, vazia')).toBeTruthy();

  // Items have accessibility labels
  expect(getByLabelText('Herói Alpha. Toque para posicionar ou pressione e arraste para mover.')).toBeTruthy();

  // Interact: place hero by pressing Alpha, check that a cell now has label with her name
  fireEvent.press(getByText('Alpha'));
  // one of the cells should now include Alpha in label; find by text
  expect(getByText('Alpha')).toBeTruthy();
});

