# Relatório de Balanceamento — Idle RPG

**Gerado em**: 12/04/2026, 14:39:48
**Iterações por cenário**: 2000
**Estágio de progressão**: Dia 3

---

## 1. Tier List Geral de Classes

Ranking agregado baseado em win rate médio de todos os cenários onde a classe aparece.

| Rank | Classe | Win Rate Médio |
|------|--------|----------------|
| 1 | Ladino (ROGUE) | 97.7% |
| 2 | Arqueiro (ARCHER) | 96.4% |
| 3 | Guerreiro (WARRIOR) | 89.6% |
| 4 | Mago (MAGE) | 85.0% |
| 5 | Tanque (TANK) | 80.1% |
| 6 | Curandeiro (HEALER) | 79.5% |

**Tier List:**
- **S**: Ladino, Arqueiro, Guerreiro, Mago, Tanque
- **A**: Curandeiro

---

## 2. Classes em Missões Solo

Win rate de cada classe sozinha em missões que aceitam 1 herói.

| Classe | Primeira Patrulha |
|--------|---|
| Guerreiro | 99% |
| Tanque | 99% |
| Ladino | 100% |
| Arqueiro | 100% |
| Mago | 99% |
| Curandeiro | 99% |

**Insight**: Melhor solo = Arqueiro, pior solo = Tanque

---

## 3. Personalidades por Classe

Melhor personalidade para cada classe na Missão 1 (solo).

| Classe | Melhor Personalidade | Win Rate | Pior Personalidade | Win Rate | Δ |
|--------|---------------------|----------|-------------------|----------|---|
| Guerreiro | 👁️ Vingativo | 100% | 🩸 Sanguinário | 99% | 1pp |
| Tanque | 👁️ Vingativo | 100% | 🦊 Oportunista | 92% | 8pp |
| Ladino | 🩸 Sanguinário | 100% | 🦊 Oportunista | 100% | 0pp |
| Arqueiro | 🩸 Sanguinário | 100% | 🦊 Oportunista | 100% | 0pp |
| Mago | 🛡️ Guardião | 100% | 👁️ Vingativo | 100% | 0pp |
| Curandeiro | 👁️ Vingativo | 100% | 🦊 Oportunista | 95% | 5pp |

**Insight**: Deltas grandes (>10pp) indicam que a escolha de personalidade importa. Deltas pequenos significam que o sistema de personalidade tem pouco impacto nessa classe.

---

## 4. Impacto de Equipamentos

Win rate por tier de equipamento na Missão 1.

| Classe | Sem itens | 1x Comum ATK | 1x Raro ATK | 1x Épico ATK | ATK+DEF Épico |
|--------|---|---|---|---|---|
| Guerreiro | 100% | 100% | 100% | 99% | 99% |
| Tanque | 99% | 100% | 100% | 100% | 100% |
| Ladino | 100% | 100% | 100% | 100% | 100% |
| Arqueiro | 100% | 100% | 100% | 100% | 100% |
| Mago | 100% | 100% | 99% | 100% | 100% |
| Curandeiro | 99% | 100% | 100% | 100% | 100% |

**Impacto dos equipamentos (Sem itens → Épico ATK+DEF):**
- Tanque: +1.4pp
- Curandeiro: +0.7pp
- Mago: +0.5pp
- Ladino: +0.1pp
- Arqueiro: +0.0pp
- Guerreiro: +-0.3pp

**Insight**: Classes com maior delta se beneficiam mais de equipamento (geralmente DPS). Classes com delta baixo estão travadas por outros fatores (HP, AGI, etc.).

---

## 5. Composições por Missão

### Expedição (mission_2)

**Top 5:**

| Composição | Win Rate | Rounds Média | HP Perdido | Sinergias |
|------------|----------|--------------|------------|-----------|
| Guerreiro + Ladino | 100% | 3.2 | 2.2 | Emboscada |
| Guerreiro + Arqueiro | 100% | 2.9 | 2.0 | - |
| Guerreiro + Mago | 100% | 3.4 | 2.6 | - |
| Guerreiro + Curandeiro | 100% | 6.7 | 4.4 | Linha de Frente |
| Tanque + Ladino | 100% | 4.0 | 3.0 | - |

**Piores 3:**

| Composição | Win Rate |
|------------|----------|
| Guerreiro + Guerreiro | 100% |
| Tanque + Tanque | 99% |
| Guerreiro + Tanque | 98% |

### Assalto à Caravana (mission_3)

**Top 5:**

| Composição | Win Rate | Rounds Média | HP Perdido | Sinergias |
|------------|----------|--------------|------------|-----------|
| Guerreiro + Guerreiro + Ladino | 100% | 4.1 | 4.6 | Emboscada |
| Guerreiro + Guerreiro + Arqueiro | 100% | 3.9 | 4.7 | - |
| Guerreiro + Guerreiro + Mago | 100% | 5.0 | 7.0 | - |
| Guerreiro + Tanque + Ladino | 100% | 5.0 | 7.9 | Emboscada |
| Guerreiro + Tanque + Arqueiro | 100% | 4.7 | 5.9 | Muralha e Flecha |

**Piores 3:**

| Composição | Win Rate |
|------------|----------|
| Tanque + Tanque + Tanque | 72% |
| Tanque + Tanque + Curandeiro | 61% |
| Guerreiro + Tanque + Curandeiro | 43% |

### Floresta Sombria (mission_4)

**Top 5:**

| Composição | Win Rate | Rounds Média | HP Perdido | Sinergias |
|------------|----------|--------------|------------|-----------|
| Tanque + Ladino | 99% | 5.8 | 15.7 | - |
| Guerreiro + Ladino | 99% | 4.5 | 10.9 | Emboscada |
| Tanque + Arqueiro | 97% | 6.3 | 18.3 | Muralha e Flecha |
| Ladino + Curandeiro | 97% | 7.0 | 6.8 | - |
| Arqueiro + Curandeiro | 95% | 5.7 | 5.5 | - |

**Piores 3:**

| Composição | Win Rate |
|------------|----------|
| Mago + Curandeiro | 31% |
| Curandeiro + Curandeiro | 18% |
| Tanque + Tanque | 0% |

### Ruínas Ancestrais (mission_5)

**Top 5:**

| Composição | Win Rate | Rounds Média | HP Perdido | Sinergias |
|------------|----------|--------------|------------|-----------|
| Guerreiro + Tanque + Arqueiro | 100% | 4.9 | 18.9 | Muralha e Flecha |
| Guerreiro + Arqueiro + Arqueiro | 100% | 3.4 | 7.8 | - |
| Tanque + Tanque + Ladino | 100% | 6.5 | 23.2 | - |
| Tanque + Tanque + Arqueiro | 100% | 6.5 | 21.3 | Muralha e Flecha |
| Tanque + Ladino + Ladino | 100% | 3.8 | 8.5 | - |

**Piores 3:**

| Composição | Win Rate |
|------------|----------|
| Tanque + Tanque + Tanque | 6% |
| Tanque + Curandeiro + Curandeiro | 0% |
| Curandeiro + Curandeiro + Curandeiro | 0% |

### Covil do Dragão (mission_boss_1)

**Top 5:**

| Composição | Win Rate | Rounds Média | HP Perdido | Sinergias |
|------------|----------|--------------|------------|-----------|
| Tanque + Guerreiro + Curandeiro + Arqueiro | 100% | 4.9 | 14.3 | Linha de Frente, Muralha e Flecha, Bastião |
| Tanque + Tanque + Curandeiro + Mago | 100% | 11.8 | 62.5 | Bastião |
| Tanque + Curandeiro + Curandeiro + Arqueiro | 100% | 6.8 | 23.5 | Muralha e Flecha, Bastião |
| Guerreiro + Ladino + Arqueiro + Mago | 100% | 3.3 | 9.5 | Caos Arcano, Emboscada, Artilharia |
| Guerreiro + Curandeiro + Arqueiro + Mago | 100% | 4.3 | 5.8 | Linha de Frente, Artilharia |

**Piores 3:**

| Composição | Win Rate |
|------------|----------|
| Ladino + Ladino + Curandeiro + Tanque | 86% |
| Guerreiro + Guerreiro + Curandeiro + Curandeiro | 72% |
| Tanque + Tanque + Guerreiro + Curandeiro | 60% |

---

## 6. Validação de Sinergias

Cada sinergia definida foi testada comparando uma comp com a sinergia ativa vs uma comp equivalente sem ela.

| Sinergia | Com Sinergia | Sem Sinergia | Δ Win Rate | Funcional? |
|----------|--------------|--------------|------------|------------|
| Linha de Frente | 69% | 95% | -26.4pp | ❌ |
| Muralha e Flecha | 99% | 94% | +5.7pp | ✅ |
| Caos Arcano | 73% | 92% | -19.3pp | ❌ |
| Bastião | 61% | 90% | -28.7pp | ❌ |
| Emboscada | 100% | 98% | +1.3pp | ❌ |
| Artilharia | 58% | 92% | -33.4pp | ❌ |

**Insight**: 1/6 sinergias têm impacto significativo (≥5pp). Sinergias com delta <2pp estão praticamente inativas e deveriam ser rebalanceadas.

---

## 7. Principais Conclusões

- ✅ **Classes equilibradas**: Gap de apenas 18pp entre melhor e pior.
- ⚠️ **Equipamentos fracos**: Impacto médio de apenas 0.4pp. Considere bônus mais fortes.
- ❌ **Sinergias majoritariamente inativas**: Apenas 1/6 funcionam. Revisar multiplicadores.
- ✅ **Personalidades estratégicas**: Delta máximo de 8pp pode mudar resultado significativamente.

---

_Relatório gerado automaticamente. Para regenerar: `npx ts-node --project tsconfig.sim.json scripts/simulations/balance_analysis.ts`_
