import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from '../../components/ui/Card';
import { Banner } from '../../components/ui/Banner';
import { Divider } from '../../components/ui/Divider';
import { Seal } from '../../components/ui/Seal';
import { Parchment } from '../../components/ui/Parchment';
import { Button } from '../../components/ui/Button';
import { OrnateFrame } from '../../components/ui/OrnateFrame';
import { theme } from '../../theme';

describe('Card', () => {
  test('renderiza children sem throw', () => {
    const { getByText } = render(<Card><Text>conteúdo</Text></Card>);
    expect(getByText('conteúdo')).toBeTruthy();
  });

  test('rarity="legendary" aplica o glow legendary', () => {
    // Card sem onPress renderiza um único View raiz com o array de estilos achatado
    const json = render(<Card rarity="legendary"><Text>x</Text></Card>).toJSON() as any;
    const flat = ([] as any[]).concat(json.props.style).filter(Boolean);
    const merged = Object.assign({}, ...flat);
    expect(merged.shadowColor).toBe(theme.elevation.glowLegendary.shadowColor);
  });
});

describe('Banner', () => {
  test('expõe o título e o subtítulo', () => {
    const { getByText } = render(<Banner title="Vila" subtitle="Bem-vindo" />);
    expect(getByText('Vila')).toBeTruthy();
    expect(getByText('Bem-vindo')).toBeTruthy();
  });

  test('renderiza o slot right', () => {
    const { getByText } = render(<Banner title="X" right={<Text>OURO</Text>} />);
    expect(getByText('OURO')).toBeTruthy();
  });
});

describe('Divider', () => {
  test('plain renderiza sem throw', () => {
    expect(() => render(<Divider />)).not.toThrow();
  });

  test('ornament renderiza um SVG central', () => {
    const { UNSAFE_queryAllByType } = render(<Divider variant="ornament" />);
    expect(UNSAFE_queryAllByType('Svg' as any).length).toBeGreaterThan(0);
  });
});

describe('Seal', () => {
  test('kind de classe resolve o brasão', () => {
    expect(() => render(<Seal kind="WARRIOR" size={32} />)).not.toThrow();
  });
  test('locked não derruba a árvore', () => {
    expect(() => render(<Seal kind="MAGE" locked />)).not.toThrow();
  });
});

describe('Parchment', () => {
  test('renderiza os children', () => {
    const { getByText } = render(<Parchment><Text>pergaminho</Text></Parchment>);
    expect(getByText('pergaminho')).toBeTruthy();
  });
});

describe('Button', () => {
  test('expõe o label', () => {
    const { getByText } = render(<Button label="Forjar" onPress={() => {}} />);
    expect(getByText('Forjar')).toBeTruthy();
  });
  test('as 4 variantes renderizam sem throw', () => {
    for (const v of ['gold', 'wood', 'danger', 'ghost'] as const) {
      expect(() => render(<Button label="x" variant={v} onPress={() => {}} />)).not.toThrow();
    }
  });
});

describe('OrnateFrame', () => {
  test('renderiza children e cantos SVG', () => {
    const { getByText, UNSAFE_queryAllByType } = render(
      <OrnateFrame><Text>moldura</Text></OrnateFrame>
    );
    expect(getByText('moldura')).toBeTruthy();
    expect(UNSAFE_queryAllByType('Svg' as any).length).toBeGreaterThan(0);
  });
});
