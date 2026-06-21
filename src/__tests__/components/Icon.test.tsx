import React from 'react';
import { render } from '@testing-library/react-native';
import { Icon } from '../../components/ui/Icon';

describe('<Icon>', () => {
  test('nome semântico renderiza o vector-icon sem throw', () => {
    expect(() => render(<Icon name="sword" size={20} />)).not.toThrow();
    const { UNSAFE_getAllByType } = render(<Icon name="shield" size={20} />);
    // o mock de vector-icons renderiza um elemento "VectorIcon"
    expect(UNSAFE_getAllByType('VectorIcon' as any).length).toBeGreaterThan(0);
  });

  test('nome de stat renderiza o SVG custom (não o vector-icon)', () => {
    const { UNSAFE_queryAllByType } = render(<Icon name="stat-hp" size={16} />);
    expect(UNSAFE_queryAllByType('VectorIcon' as any).length).toBe(0);
  });

  test('nome de classe renderiza sem throw', () => {
    expect(() => render(<Icon name="class-mage" size={24} />)).not.toThrow();
  });

  test('nome inválido (via cast) não derruba a árvore', () => {
    expect(() => render(<Icon name={'inexistente' as any} size={16} />)).not.toThrow();
  });
});
