# Balance & Economia — Design Spec

**Data**: 2026-06-20
**Status**: Spec proposto, aguardando revisão
**Referência**: SPEC 4 do `docs/superpowers/ROADMAP-2026-H2.md` (Horizonte 2 — "Cara Nova + Jogo Justo")
**Escopo**: Tornar sinergias, personalidades e equipamentos mecanicamente relevantes; medir e ajustar o ritmo econômico (gold/hora, custo de recrutar vs forjar, tempo até 1ª fusão e 1º boss); decidir o gate de estrela do boss semanal; transformar `balance_analysis.ts` em gate de CI; consolidar os scripts de simulação legados.

---

## 1. Contexto e Problema

### 1.1 Estado medido (relatório commitado + run fresco)

`scripts/simulations/BALANCE_REPORT.md` (2000 iterações, estágio "Dia 3") e um run fresco de `npm run simulate -- --mission=1` (10000 iterações, 71.8s, exit 0, output em `scripts/simulations/missions/mission_1_results.txt`) mostram três patologias:

**(a) Sinergias inertes (§6 do relatório).** Só 1/6 passa o limiar de +5pp:

| Sinergia | Com | Sem | Δ |
|---|---|---|---|
| Linha de Frente | 69% | 95% | **−26.4pp** |
| Muralha e Flecha | 99% | 94% | **+5.7pp** ✅ |
| Caos Arcano | 73% | 92% | **−19.3pp** |
| Bastião | 61% | 90% | **−28.7pp** |
| Emboscada | 100% | 98% | +1.3pp |
| Artilharia | 58% | 92% | **−33.4pp** |

**(b) Personalidades quase nulas (§3).** 4/6 classes com Δ ≤ 1pp entre melhor e pior personalidade (Guerreiro 1pp, Ladino 0pp, Arqueiro 0pp, Mago 0pp). Só Tanque (8pp) e Curandeiro (5pp) mostram sinal. (O catálogo tem **5** personalidades — `AGGRESSIVE`, `PROTECTOR`, `CAUTIOUS`, `VENGEFUL`, `OPPORTUNIST` — `src/constants/personalities.ts:12-36`; o relatório mede Δ por classe, não por personalidade.)

**(c) Equipamentos irrelevantes (§4).** Impacto médio Sem-itens → Épico ATK+DEF = **0.4pp**. Guerreiro chega a **−0.3pp** (ruído estatístico).

### 1.2 Diagnóstico de raiz (fundamentado no código lido)

O número negativo das sinergias é **artefato da metodologia de teste**, não prova de sinergia fraca. `sweepSynergies()` (`scripts/simulations/balance_analysis.ts:287-328`) compara:

```ts
const withClasses  = [synergy.classes[0], synergy.classes[1]];     // o par sinérgico
const neutral      = withClasses.includes('WARRIOR') ? 'ARCHER' : 'WARRIOR';
const withoutClasses = [synergy.classes[0], neutral];              // troca 2ª classe por WARRIOR/ARCHER
```

A comp "sem sinergia" **substitui a segunda classe da dupla por um Guerreiro ou Arqueiro** — que o próprio relatório aponta como Tier-S (Arqueiro 96.4%, Guerreiro 89.6% de win médio; §1). Ex.: Bastião = TANK+HEALER (61%) vs TANK+ARCHER (90%): o Δ −29pp mede "Arqueiro é melhor que Curandeiro num par", **não** "Bastião não funciona". A sinergia em si pode estar ativando corretamente — `src/utils/synergyEffects.ts` tem implementações reais por hook (ex.: `LINHA_DE_FRENTE:21-33` aplica `atkMul 1.30` ao curar Guerreiro; `MURALHA_E_FLECHA:37-74` aplica taunt+range+crit; `CAOS_ARCANO:89-102` aplica `defDebuffMul 0.5`; `ARTILHARIA:115-148` faz splash com `state.rng()`). O teste só não isola o efeito.

Segundo fator: **saturação de win rate**. No estágio "Dia 3" quase tudo ganha (§2 do relatório: 99–100% solo na Missão 1; §4: todas as classes 99–100% em todas as condições de equipamento). Quando o baseline é 100%, **não há headroom para medir +Δ** de sinergia, personalidade ou equipamento — qualquer efeito positivo fica preso no teto.

Terceiro fator (equipamentos): o harness usa valores **hardcoded divergentes da produção**. `makeEquipment(3,'atk',15)` (`balance_analysis.ts:79-87`) crava +15 de ATK fixo. A geração real em `src/context/equipmentHandler.ts:9-22` escala o roll por tier: `tierMin = sr.min * tier; tierMax = sr.max * tier`. Para arma (`statRange atk 2-8`, `equipment.ts:14`), um Épico (tier 3) rola **6–24** de ATK, não 15. O harness **subestima** o teto Épico e ignora que o roll é tier-multiplicativo. Mesmo corrigido, num baseline de 100% o ganho permaneceria invisível — o problema real é medir no estágio errado.

### 1.3 Economia: nenhum relatório mede ritmo

Nenhum dos relatórios (`BALANCE_REPORT.md`, `mission_*_results.txt`) toca em gold/hora, custo de progressão ou pacing. As constantes existem mas seu encadeamento nunca foi simulado ponta-a-ponta:

- `GameMath.calcMissionReward` (`src/utils/gameMath.ts:34-85`): curva `pow(normalized, exponent)` com `ref`/`exponent`/`synergyK`/`scale` por missão (`missions.ts`).
- `GameMath.getRecruitCost` (`gameMath.ts:23-27`): `10 * 1.5^heroesRecruited` (`game.ts:75,81`).
- Forja: `EQUIPMENT_TIERS` custa 50/150/400 gold, forja em 30s/60s/120s (`equipment.ts:7-11`).
- Estado inicial: `gold: 20` (`gameReducer.ts:34`).
- Fusão: `handleFuseHeroes` (`pantheonHandler.ts:103-127`) consome 3 heróis `IDLE`, **sem custo de gold e sem requisito de estrela** — só `currentTask === HeroTask.IDLE`.

### 1.4 Gate de estrela do boss semanal: ausente

`markWeeklyBossDefeated` (`src/context/weeklyHandler.ts:71-78`) só seta `bossDefeated: true` e emite milestone. Não há nenhuma checagem de "≥1 herói com estrela" (grep por `star|estrela` em `weeklyHandler.ts`/`weeklyQuests.ts`: zero hits). O gate citado em specs antigos nunca foi implementado.

### 1.5 Scripts legados divergentes

`scripts/simulate_full.js` reimplementa `calcMissionReward` (`simulate_full.js:50-74`) com parâmetros **divergentes da produção**: `statWeights atk: 1.0/1.2/1.25` (produção usa `0.3`, `missions.ts:49`), `scale 1.0/1.15/1.25` (produção `1.3` na M1), e chama com `ref:250, exponent:2` hardcoded sem os overrides por missão (`ref:40, exponent:1.5` na M1). Esses `.js` não são referenciados por nenhum `package.json`/CI (grep: zero hits; `.github/workflows/` não existe). São fonte de números enganosos.

### 1.6 Dor concreta

O jogo **anuncia** profundidade (6 sinergias, 5 personalidades, 3 tiers de equipamento na UI) que o jogador **não sente**: escolher personalidade ou forjar Épico não muda resultado perceptível. E não existe instrumento que prove pacing saudável antes do lançamento — risco de "parede de gold" ou "trivialidade infinita" passar despercebido.

---

## 2. Objetivos e Não-Objetivos

### 2.1 Objetivos (mensuráveis)

1. **Metodologia de sinergia correta**: medir par-com-sinergia vs **o mesmo par com o efeito desligado** (não troca de classe). Após isso, ≥5/6 sinergias com Δ ≥ +5pp num estágio com headroom.
2. **Personalidades no alvo**: cada uma das **5** (`personalities.ts:12-36`) com Δ ≥ +3pp (e ≤ +10pp) na classe onde mais faz sentido, medido contra "sem personalidade".
3. **Equipamentos relevantes**: Sem-itens → conjunto Épico ≥ +8pp médio, medido em estágio com headroom e usando a fórmula de roll **real** (tier-multiplicativa).
4. **Ritmo econômico medido**: novo sweep reporta gold/hora por missão e estágio, custo cumulativo de recrutamento, tempo até 1ª forja/1ª fusão/1º boss; com alvos de pacing definidos (§3.5).
5. **Gate de estrela do boss**: decisão oficial (implementar — §3.6) com teste.
6. **Balance como gate de CI**: `balance_analysis.ts` emite código de saída ≠0 quando thresholds são violados; consumível por `npm run balance:check`.
7. **Consolidação de scripts**: legados `.js` divergentes removidos; um único caminho de simulação fiel à produção.

### 2.2 Não-Objetivos (YAGNI)

- **Novas classes, missões, sinergias ou personalidades** — é SPEC 7 (conteúdo). Aqui só rebalanceia o existente.
- **Redesign de telas / UI de balanço** — SPEC 3.
- **Gold passivo / idle reward fora de missão** — proibido pela regra do dono; missão em loop continua o único mecanismo offline.
- **Tornar DEF/CRIT/AGI treináveis** — proibido; secundários só por equip/passiva/fusão.
- **Refatorar `battleEngine.ts`/`tickHandler.ts`** — SPEC 6. Este spec só lê o engine e adiciona hooks de teste, sem quebrá-lo.
- **Setup de runner de CI (GitHub Actions)** — fora do repo hoje; entregamos o script com exit-code e o comando npm. A integração ao pipeline é responsabilidade de quem montar o CI (SPEC 9/infra).

---

## 3. Design Detalhado

### 3.1 Sinergias: metodologia A/B por efeito (não por classe)

**Raiz**: o teste atual confunde "efeito da sinergia" com "qualidade da classe trocada".

**Correção de medição** (a peça central). Em vez de trocar a 2ª classe, mede-se a **mesma composição** com os handlers de sinergia **ligados vs desligados**. `createSynergyHandlers([])` já retorna `NOOP_HANDLERS` (`synergyEffects.ts:155-156`), então o "controle" é trivial: rodar o par com `active = []`.

Nova função no harness:

```ts
// scripts/simulations/balance_analysis.ts
interface SynergyTest {
  name: string;
  pair: ClassId[];           // a dupla canônica da sinergia
  withWin: number;           // par + handler ATIVO
  withoutWin: number;        // MESMO par + handler DESLIGADO (NOOP)
  delta: number;
}

function sweepSynergies(): SynergyTest[] {
  const mission = SYNERGY_STAGE_MISSION;   // calibrado p/ baseline da dupla cair em 40-75% (§3.4); NÃO hardcode 'mission_4' sem checar
  return SYNERGIES.map(syn => {
    const pair = [syn.classes[0], syn.classes[1]];
    const heroes = pair.map(buildHero);                       // mesmas instâncias/seed
    const withR    = runMissionSimulation({ heroes, missionId: mission,
                       iterations: ITERATIONS, forceSynergies: [syn.id] });
    const withoutR = runMissionSimulation({ heroes, missionId: mission,
                       iterations: ITERATIONS, forceSynergies: [] });  // NOOP
    return { name: syn.name, pair,
             withWin: parsePercent(withR.winRate),
             withoutWin: parsePercent(withoutR.winRate),
             delta: parsePercent(withR.winRate) - parsePercent(withoutR.winRate) };
  });
}
```

Isso exige um parâmetro `forceSynergies?: SynergyId[]` que sobrepõe a detecção automática por `getActiveSynergies`. **Atenção ao ponto de injeção**: a detecção é hardcoded em `BattleEngine.createInitialState` (`battleEngine.ts:191`: `const activeSynergyDefs = getActiveSynergies(classIds)`), não no runner. O runner (`simulationRunner.ts:59`) só repassa para `BattleEngine.initializeBattle(...)`. Logo o override atravessa: `runMissionSimulation` aceita `forceSynergies` → passa em `opts` de `initializeBattle` (`battleEngine.ts:180-183`, estender o tipo de `opts`) → `createInitialState` usa `opts.forceSynergies ?? getActiveSynergies(classIds).map(s => s.id)`. É um hook de **teste** (controlado por parâmetro opcional; produção continua auto-detectando), mas implica **duas** edições no engine (esta + o fix de Bastião §3.1.1) — ver §3.1.1 e §4.

**Estágio com headroom**: medir num estágio onde o baseline da dupla fique em **40–75%** de win (não 99%). Day-3 satura; o sweep de sinergia passa a usar um estágio menor (ex.: "30 min" de treino) **ou** a missão mais dura (`mission_boss_1`), escolhido empiricamente para o baseline cair na janela. Define-se `SYNERGY_STAGE_MS` separado de `STAGE_MS`.

**Ajustes de potência** (só se, com medição correta + headroom, ainda Δ < +5pp). Cada sinergia tem um parâmetro único a girar, todos em `src/utils/synergyEffects.ts`:

| Sinergia | Parâmetro atual | Alavanca | Local |
|---|---|---|---|
| Linha de Frente | `atkMul 1.30`, 1 turno | subir p/ 1.40 e/ou 2 turnos | `synergyEffects.ts:30-31` |
| Muralha e Flecha | `critFlat 20`, `taunt 60` | já +5.7pp — manter | `synergyEffects.ts:51-52` |
| Caos Arcano | `defDebuffMul 0.5`, 1 turno | 2 turnos ou `0.4` | `synergyEffects.ts:97-98` |
| Bastião | flag só arma cura AoE | conectar flag a heal real no engine (ver §3.1.1) | `synergyEffects.ts:78-85` |
| Emboscada | ignora DEF rounds 1-2 | estender p/ round 3 | `synergyEffects.ts:107` |
| Artilharia | 50% splash, 50% dano | 60% chance ou `0.6` dano | `synergyEffects.ts:119,133` |

#### 3.1.1 Bastião: bug funcional confirmado

`BASTIAO` (`synergyEffects.ts:77-86`) só seta `state.flags['bastion_armed'] = true`. Grep no engine: **nenhum consumidor lê `bastion_armed`**. A sinergia arma um gatilho que ninguém puxa — está **inerte por bug**, não por número fraco. Fix: no passo de cura do Curandeiro (`battleEngine.ts`, em torno de `state.handlers.onHealApplied`/`:505`), se `flags['bastion_armed']`, aplicar a cura em AoE (todos os heróis vivos) e limpar a flag.

**Duas edições no `battleEngine.ts` são autorizadas por este spec**, ambas cirúrgicas e isoladas: (1) este consumo de `bastion_armed` no passo de cura; (2) o ponto de injeção de `forceSynergies` em `createInitialState:191` (hook de teste, §3.1). Nenhuma é refator estrutural — isso é SPEC 6. Cada uma com teste dedicado.

### 3.2 Personalidades: medir contra "sem personalidade"

**Raiz**: §3 atual compara melhor-vs-pior personalidade na **Missão 1 saturada** (todas ~100%). O delta verdadeiro é "personalidade vs ausência dela", e precisa de headroom.

Novo sweep:

```ts
// baseline = MESMO herói com hero.personality = undefined
function sweepPersonalities(): PersonalityResult[] {
  const mission = PERSONALITY_STAGE_MISSION;  // missão/estágio com baseline 40-75%
  const out: PersonalityResult[] = [];
  for (const classId of CLASSES) {
    const base = build(classId, { personality: undefined });
    const baseWin = win(base, mission);
    for (const p of PERSONALITY_LIST) {
      const h = build(classId, { personality: p.id });
      out.push({ classId, personality: p.id, mission,
                 winPct: win(h, mission), deltaVsNone: win(h, mission) - baseWin });
    }
  }
  return out;
}
```

`applyPersonalityOnHit` (`personalityEffects.ts:19-73`) e `applyProtectorShield` (`:79-97`) já têm efeitos reais. Alavancas, se Δ < +3pp após headroom:

| Personalidade | Atual | Alavanca | Local |
|---|---|---|---|
| AGGRESSIVE | `atkMul 1.15` se alvo <30% HP | gatilho <40% ou `1.20` | `personalityEffects.ts:31-37` |
| CAUTIOUS | `critFlat 10` se não moveu | `15` | `personalityEffects.ts:44-46` |
| VENGEFUL | `atkMul 1.25` se foi atacado | manter (já forte) | `personalityEffects.ts:54-57` |
| OPPORTUNIST | 25% ataque extra ao matar | 35% | `personalityEffects.ts:64` |
| PROTECTOR | `shield 0.20` a aliado <50% | `0.25` ou raio 2 | `personalityEffects.ts:88-90` |

São as **5** personalidades do catálogo (`personalities.ts:12-36`) — não há 6ª. Cada classe declara sua personalidade "natural" (alvo +3–10pp ali); as demais podem ficar neutras, mas **nenhuma** pode ser negativa. Há 6 classes e 5 personalidades, então pelo menos uma personalidade é "natural" de mais de uma classe — basta que cada personalidade atinja o alvo em ≥1 classe.

### 3.3 Equipamentos: fórmula real + headroom + curva de tier

**Três correções:**

1. **Usar a geração de produção.** Trocar `makeEquipment(tier, stat, valorFixo)` (`balance_analysis.ts:79-87`) por `generateEquipment(tier, type)` importado de `equipmentHandler.ts`, com roll **determinístico** (passar `rng` seedado em vez de `Math.random` — pequena extração para aceitar rng injetado). Assim o sweep mede 6–24 ATK no Épico, não 15 fixo.
2. **Medir com headroom.** Estágio onde o herói sem-itens fique em 40–75% de win.
3. **Curva de recompensa vs statRange.** Verificar que cada tier "vale" o que custa. Comparativo a reportar:

   | Tier | Custo gold | atk roll (arma) | def roll (armadura) | Δwin esperado |
   |---|---|---|---|---|
   | Comum (1) | 50 | 2–8 | 3–10 | pequeno |
   | Raro (2) | 150 | 4–16 | 6–20 | médio |
   | Épico (3) | 400 | 6–24 | 9–30 | grande |

   Alavanca, se a curva for fraca: ajustar `statRange.max` por template em `equipment.ts:13-17` (ex.: arma `max 10` → Épico chega a 30) **mantendo o multiplicador de tier**. Sem tocar nos secundários treináveis (DEF/CRIT/AGI continuam só-equip).

### 3.4 Estágios de medição (a peça que destrava (a)(b)(c))

Headroom tem **dois botões independentes**: o tempo de treino do herói (`ms`, menos treino = herói mais fraco) e a dificuldade da missão (missão mais dura = inimigo mais forte). O harness expõe os dois e a calibração escolhe a combinação que põe o baseline em 40–75%:

```ts
// Tempo de treino por estágio (substitui o STAGE_MS único atual = Dia 3)
const STAGES = {
  HEADROOM: { ms: 30*60*1000, label: '30 min' },   // herói pouco treinado
  MIDGAME:  { ms: 3*24*60*60*1000, label: 'Dia 3' },// progressão (STAGE_MS atual)
};

// Missão usada por cada sweep de headroom (calibrada empiricamente, §3.1/§3.3)
const SYNERGY_STAGE_MISSION    = 'mission_4';      // ajustar até baseline da dupla cair em 40-75%
const PERSONALITY_STAGE_MISSION = 'mission_4';     // idem (§3.2)
const EQUIP_STAGE_MISSION       = 'mission_4';     // idem (§3.3)
```

`STAGES.HEADROOM.ms` e `*_STAGE_MISSION` são os dois eixos; o valor `'mission_4'` acima é **chute inicial**, não verdade — o sweep imprime o baseline e a calibração (§7, risco "estágio errado") gira `ms` e/ou a missão até a janela 40–75%. Sinergias, personalidades e equipamentos medem nesse ponto de headroom (onde Δ é observável) **e** reportam `MIDGAME` (Dia 3, onde o jogador real passa o tempo). A tier-list de classe continua só em `MIDGAME`. Sem headroom, todo Δ fica preso no teto de 100% — causa-raiz comum de (a)(b)(c).

### 3.5 Ritmo econômico: novo sweep `sweepEconomy()`

Sexto sweep no orquestrador, puramente determinístico (sem combate — só a math de reward/custo):

```ts
interface EconomyRow {
  missionId: string;
  stageLabel: string;
  goldPerRun: number;        // calcMissionReward médio (rng seedado, N amostras)
  runsPerHour: number;       // 3_600_000 / durationMs
  goldPerHour: number;       // goldPerRun * runsPerHour
}
```

Reporta também, derivado das constantes reais:

- **Custo cumulativo de recrutamento**: `Σ getRecruitCost(i)` para i=0..N. Com `10 * 1.5^n`: heróis 1→5 custam 10+15+22+33+50 = **130 gold**.
- **Tempo até 1ª forja**: gold p/ Comum (50) ÷ gold/hora da melhor missão acessível no estágio inicial.
- **Tempo até 1ª fusão**: a fusão não custa gold (`pantheonHandler.ts:103-127`), custa **3 heróis idle** → custo = 3 recrutamentos (`getRecruitCost`) + tempo de obter estrela. Reportar em gold-equivalente e em nº de missões.
- **Tempo até 1º boss**: gold/stats para cumprir os requisitos do `mission_boss_1` (`missions.ts:154-158`: HP médio ≥20, ATK médio ≥12, requer Tanque).

**Alvos de pacing** (binários, viram thresholds de CI):

| Métrica | Alvo | Justificativa |
|---|---|---|
| Gold/hora M1 (estágio inicial) | 30–120 | 1ª forja (50) acessível em <2h de jogo ativo |
| 1ª fusão | alcançável em < ~1 dia de jogo idle | mecânica de meta deve aparecer cedo |
| 1º boss | gating por stat, não por parede de gold | boss é desafio de composição, não de farm |
| Curva gold/hora entre missões | monotônica crescente | progressão sempre recompensa subir de missão |
| Gold passivo fora de missão | **0** (invariante) | regra do dono — teste garante |

Não se inventa nenhum número novo de economia sem o sweep mostrar a curva atual primeiro; os alvos acima são as faixas a perseguir, e o ajuste fino (mexer em `ref`/`scale`/`rewardMax` por missão em `missions.ts`) é guiado pelo output.

### 3.6 Gate de estrela do boss semanal: IMPLEMENTAR

**Decisão: implementar** (não cortar). Justificativa:

- O sistema de estrelas/fusão já existe e funciona (`pantheonHandler.ts`), mas hoje é **opcional e sem propósito de gate** — fundir não destrava nada exclusivo.
- O boss semanal é o conteúdo de fim de loop. Exigir "≥1 herói com estrela" dá **razão para fundir** (fecha o loop recrutar→treinar→fundir→boss) sem violar nenhuma regra do dono (não é gold passivo, não treina secundário).
- Custo de implementação é mínimo e localizado.

Implementação em `weeklyHandler.ts`:

```ts
export function markWeeklyBossDefeated(state: GameState): GameState {
  if (!state.weeklyState) return state;
  const hasStarred = state.heroes.some(h => (h.stars ?? 0) > 0);
  if (!hasStarred) return state;            // gate: precisa de ≥1 herói com estrela
  emitWeeklyBossDefeated();
  return { ...state, weeklyState: { ...state.weeklyState, bossDefeated: true } };
}
```

A chamada que dispara o boss (no fluxo de missão/tick que invoca `markWeeklyBossDefeated`) deve **sinalizar à UI** o motivo do bloqueio (sem estrela), mas o feedback visual é SPEC 3 — aqui entregamos só a regra + teste e um campo de retorno/evento se necessário.

### 3.7 Gate de CI: exit-code + thresholds

`balance_analysis.ts` ganha um bloco de validação ao final do `main()`:

```ts
interface Thresholds {
  synergyMinDelta: number;       // 5  (pp), exige ≥5/6
  personalityMinDelta: number;   // 3  (pp) por classe natural
  equipmentMinDelta: number;     // 8  (pp) sem→épico
  classGapMax: number;           // 30 (pp) entre melhor e pior classe
  economyMonotonic: boolean;     // gold/hora cresce por missão
  noPassiveGold: boolean;        // invariante
}
function assertThresholds(report: ReportData, t: Thresholds): string[] { /* erros */ }
```

`main()` coleta as violações; se houver, `console.error` lista e `process.exit(1)`. Novo script:

```json
"balance:check": "npx ts-node --project tsconfig.sim.json scripts/simulations/balance_analysis.ts --ci"
```

Sem `--ci`, comportamento atual (gera relatório, exit 0). Com `--ci`, valida e falha. Os thresholds vivem num objeto único no topo do arquivo, versionado.

### 3.8 Consolidação de scripts legados

`simulate_full.js`, `simulate_grid.js`, `simulate_training_missions.js` reimplementam a math divergente (§1.5) e não são referenciados. **Remover os três**. O único caminho de simulação passa a ser `scripts/simulations/*.ts`, que importam `GameMath`/constantes reais — garantindo que o número simulado é o número de produção.

---

## 4. Mudanças por Arquivo

| Arquivo | Ação | O que muda |
|---|---|---|
| `scripts/simulations/balance_analysis.ts` | Modificar | `sweepSynergies` A/B por efeito (NOOP vs ativo, §3.1); `sweepPersonalities` vs sem-personalidade (§3.2); `sweepEquipment` usa `generateEquipment` real + rng seedado (§3.3); adicionar `STAGES` (§3.4); novo `sweepEconomy` (§3.5); bloco `assertThresholds` + flag `--ci` (§3.7). Remover `makeEquipment` hardcoded (`:79-87`). |
| `scripts/utils/simulationRunner.ts` | Modificar | Aceitar `forceSynergies?: SynergyId[]` em `SimulationParams` e repassá-lo a `BattleEngine.initializeBattle` via `opts` (hook de teste, §3.1). |
| `src/utils/synergyEffects.ts` | Modificar (condicional) | Ajustes de potência por sinergia se Δ<+5pp após medição correta (§3.1, tabela). Bastião: nada aqui muda além de manter a flag. |
| `src/utils/battleEngine.ts` | Modificar (cirúrgico, **2 toques**) | (1) `createInitialState:191` aceita `opts.forceSynergies` sobrepondo `getActiveSynergies(classIds)` — e `initializeBattle:180-183` estende o tipo de `opts` (hook de teste, §3.1). (2) No passo de cura (`:505`), consumir `flags['bastion_armed']` → cura AoE + limpar flag (§3.1.1). Sem refator (isso é SPEC 6). |
| `src/utils/personalityEffects.ts` | Modificar (condicional) | Ajustes de potência por personalidade se Δ<+3pp (§3.2, tabela). |
| `src/constants/equipment.ts` | Modificar (condicional) | `statRange.max` por template se a curva de tier for fraca (§3.3); manter multiplicador de tier de `equipmentHandler.ts`. |
| `src/constants/missions.ts` | Modificar (condicional) | Ajuste fino de `ref`/`scale`/`rewardMax` por missão se o sweep de economia mostrar curva não-monotônica ou parede de gold (§3.5). |
| `src/context/weeklyHandler.ts` | Modificar | `markWeeklyBossDefeated` ganha gate `heroes.some(h => stars>0)` (§3.6). |
| `package.json` | Modificar | Novo script `balance:check` (§3.7). |
| `scripts/simulate_full.js` | **Remover** | Math divergente, não referenciado (§1.5, §3.8). |
| `scripts/simulate_grid.js` | **Remover** | idem. |
| `scripts/simulate_training_missions.js` | **Remover** | idem. |
| `src/utils/synergyEffects.test.ts` | Criar | Testes unit dos hooks (§5). |
| `src/utils/personalityEffects.test.ts` | Criar/estender | Testes unit dos buffs de personalidade (§5). |
| `src/context/weeklyHandler.test.ts` | Criar/estender | Gate de estrela do boss (§5). |
| `src/context/equipmentHandler.test.ts` | Criar/estender | Roll tier-multiplicativo determinístico (§5). |

---

## 5. Estratégia de Teste

TDD onde a lógica é crítica (gate do boss, hooks de sinergia, fórmula de economia). "Integração > mock": os testes de balanço rodam o **engine e a math reais**, nunca valores fabricados.

### 5.1 Unit

- **`synergyEffects.test.ts`**:
  - `LINHA_DE_FRENTE`: curar Guerreiro adiciona buff `atkMul 1.30` expirando em `rounds+1`; curar não-Guerreiro ou heal=0 → nada.
  - `MURALHA_E_FLECHA`: com Tanque vivo, Arqueiro recebe `rangeFlat 1` + `critFlat 20`; Tanque recebe `taunt`; ao morrer o último Tanque (`onHeroDamaged` hpAfter≤0), buffs `MURALHA_E_FLECHA` são removidos.
  - `CAOS_ARCANO`: ataque de Mago com dmg>0 aplica `defDebuffMul 0.5` ao alvo; ataque de não-Mago → nada.
  - `BASTIAO` (TDD do fix §3.1.1): Tanque cai <50% → `flags.bastion_armed=true`; **próxima cura do Curandeiro vira AoE e limpa a flag** (este teste falha hoje, define o fix).
  - `ARTILHARIA`: com `rng` seedado <0.5 e distância≥2, há splash de `floor(dmg*0.5)` num vizinho ≤2 hex; rng≥0.5 → sem splash (determinístico via seed).
- **`personalityEffects.test.ts`**: cada `case` de `applyPersonalityOnHit` e `applyProtectorShield` — gatilho liga/desliga nas condições corretas; `OPPORTUNIST` retorna `true` só quando `target.hp<=0 && rng<0.25` (rng seedado).
- **`weeklyHandler.test.ts`**: `markWeeklyBossDefeated` com 0 heróis estrelados → estado inalterado (`bossDefeated` continua false, milestone não emite); com ≥1 estrelado → `bossDefeated:true`.
- **`equipmentHandler.test.ts`**: `generateEquipment(3,'weapon')` com rng injetado rola ATK em [6,24]; tier 1 em [2,8]. Garante o multiplicador de tier.

### 5.2 Integração (harness como teste)

- `balance_analysis.ts --ci` num run reduzido (ex.: `ITERATIONS=500`) usado como teste de fumaça: sai 0 quando thresholds passam, ≠0 quando um threshold é forçado a violar (injetar synergyMinDelta absurdo prova que o gate morde).
- `sweepEconomy`: asserção de **monotonicidade** (gold/hora M1<M2<M3<...) e de **gold passivo = 0** (rodar `calcMissionReward` sem missão completada não credita nada — espelha a regra do dono).

### 5.3 Validação manual (emulador/browser)

Balanço é numérico, mas a percepção é o produto. Após ajustes, abrir o app (Playwright/emulador) e confirmar:
- Forjar Épico e equipar muda stat visível na ficha do herói.
- Selecionar personalidade muda o resultado de uma missão difícil (não trivial).
- Boss semanal mostra bloqueio quando nenhum herói tem estrela (regra nova).
Convenção do projeto: tela/feature só é "pronta" após validação visual; aqui o gate visual fino do boss é SPEC 3, então validamos a **regra** no emulador via estado, não o polish.

---

## 6. Critérios de Aceitação

Binários e mensuráveis:

1. `npx tsc --noEmit` → **0 erros**.
2. `npm test` (jest.unit.config.js) → **verde**, incluindo os novos testes de §5.1/§5.2.
3. `npm run balance:check` → **exit 0** num run completo; e **exit 1** comprovado ao violar artificialmente um threshold.
4. Sinergias: **≥5/6 com Δ ≥ +5pp** no relatório, medido pela metodologia A/B-por-efeito (§3.1), em estágio com headroom.
5. Bastião: teste de cura AoE passa (flag deixa de ser inerte).
6. Personalidades: **5/5 com Δ ≥ +3pp** em ≥1 classe (a "natural" daquela personalidade); **nenhuma negativa** em nenhuma classe.
7. Equipamentos: **Sem-itens → Épico ≥ +8pp médio**, com roll tier-multiplicativo real.
8. Economia: relatório contém seção com gold/hora por missão×estágio, custo cumulativo de recrutamento, tempo até 1ª forja/fusão/boss; curva gold/hora **monotônica** entre missões.
9. Invariante **gold passivo = 0** coberta por teste e verde.
10. `markWeeklyBossDefeated` **bloqueia** sem herói estrelado (teste verde).
11. `simulate_full.js`, `simulate_grid.js`, `simulate_training_missions.js` **removidos**; `grep -r simulate_full` → 0 hits fora do git history.
12. Nenhuma alteração torna DEF/CRIT/AGI treináveis; nenhum gold creditado fora de missão completada (revisão de diff confirma).

---

## 7. Riscos e Mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Ajustar potência de sinergia/personalidade desbalanceia a tier-list de classe (gap >30pp) | Médio | `classGapMax` é threshold de CI; rodar `balance:check` após cada ajuste, não só no fim. |
| Os 2 toques no `battleEngine.ts` (Bastião + injeção de `forceSynergies`) introduzem regressão no engine (791 LOC, alta superfície) | Alto | Ambos mínimos e isolados — consumir 1 flag no passo de cura, e um `??` em `createInitialState` que preserva o caminho de produção quando `forceSynergies` é `undefined`; TDD escreve o teste antes; suite de battle determinística (#47) detecta regressão. |
| Estágio "headroom" escolhido errado (ainda satura, ou zera o baseline) | Médio | Calibrar empiricamente: o sweep imprime o baseline; ajustar `SYNERGY_STAGE_MS` até cair em 40–75% antes de tirar conclusões. |
| Equipamentos ficam **dominantes** (>30pp) ao corrigir a fórmula | Médio | `equipmentMinDelta` tem alvo +8pp mas o relatório também alerta >30pp (lógica já existe em `balance_analysis.ts:562`); ajustar `statRange` para a faixa. |
| Gate de estrela frustra jogador que não entende fusão | Médio (produto) | Feedback claro é SPEC 3/5 (FTUE); aqui só a regra + evento. Mensagem de bloqueio explicada na UI fica como dependência declarada (§8). |
| Sweep de economia diverge da produção por usar amostragem própria | Alto | `sweepEconomy` importa `GameMath.calcMissionReward` e `getRecruitCost` reais — proibido reimplementar (foi o pecado dos `.js` legados). |
| `--ci` torna build lento (10k iterações × 6 sweeps) | Baixo | Modo `--ci` usa `ITERATIONS` reduzido (ex.: 500–1000), suficiente p/ thresholds de pp; relatório completo fica no modo sem flag. |

---

## 8. Dependências e Sequenciamento

**Depende de:**
- **SPEC 1 (Estabilização)**: `tsc` verde e suite limpa são pré-condição — não dá pra confiar em thresholds com a base vermelha. O bug de gold offline (SPEC 1) precisa estar resolvido antes de medir economia, senão o gold/hora idle medido é fantasia.
- **Determinismo #47** (já mergeado): o engine seedável é o que permite medir Δ de pp confiável e testes de splash/oportunista determinísticos.

**Se beneficia de (não bloqueante):**
- **SPEC 6 (Refatoração)**: engine modular facilita instrumentar/inserir o hook de Bastião com menos risco. Se SPEC 6 vier antes, o toque em `battleEngine.ts` (§3.1.1) fica mais limpo. O roadmap (`ROADMAP-2026-H2.md:76`) confirma: "SPEC 4 se beneficia de SPEC 6 ... mas não depende".

**Destrava:**
- **SPEC 3 (Redesign)**: a UI de sinergias/personalidades/boss passa a ter o que comunicar (efeitos reais e mensuráveis) — sem balanço relevante, polir essas telas é maquiar nada. O feedback visual do gate de estrela do boss (§3.6) é consumido por SPEC 3.
- **SPEC 5 (Onboarding)**: o pacing econômico medido (§3.5) informa o estado inicial revisto e o ritmo do tutorial.
- **SPEC 7 (Conteúdo)**: novas classes/missões só devem entrar sobre um balanço com gate de CI; o `balance:check` vira a rede de segurança que impede conteúdo novo de quebrar o equilíbrio silenciosamente.

---

*Gerado em 2026-06-20. Fundamentado em leitura de `balance_analysis.ts`, `synergyEffects.ts`, `synergies.ts`, `personalityEffects.ts`, `equipment.ts`, `equipmentHandler.ts`, `gameMath.ts`, `weeklyHandler.ts`, `pantheonHandler.ts`, `missions.ts`, `game.ts`, `simulate_full.js`, do `BALANCE_REPORT.md` commitado e de um run fresco de `npm run simulate -- --mission=1`.*
