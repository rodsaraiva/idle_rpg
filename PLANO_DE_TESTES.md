# Plano de Testes - Idle RPG

Este documento descreve a estratégia, escopo e estrutura de testes do projeto Idle RPG.

## 1. Estratégia de Testes

O projeto utiliza três níveis principais de testes para garantir a qualidade do código e a estabilidade das funcionalidades de jogo:

1. **Testes Unitários:** Focam em testar funções, utilitários matemáticos, reducers e lógicas de jogo isoladas.
2. **Testes de Integração:** Focam em testar a interação entre diferentes partes do sistema, principalmente hooks customizados e contextos.
3. **Testes End-to-End (E2E):** Focam em testar fluxos completos da interface de usuário simulando a interação do jogador.

## 2. Ferramentas Utilizadas

- **Jest:** Framework principal para execução de testes unitários e de integração.
- **React Native Testing Library:** Utilitários para testar componentes React e hooks em um ambiente simulado.
- **Playwright:** Framework para testes End-to-End no ambiente web (Expo Web).

## 3. Estrutura de Diretórios de Testes

Os testes estão organizados em duas pastas principais:

- `src/__tests__/`: Contém todos os testes unitários e de integração.
  - `context/`: Testes dos reducers e handlers do estado do jogo (Ex: `gameReducer.test.ts`, `missionHandler.test.ts`).
  - `hooks/`: Testes dos hooks customizados que conectam a UI com a lógica do jogo (Ex: `useGame.test.tsx`, `useMissions.test.tsx`).
  - `services/`: Testes de serviços externos como armazenamento e feedback (Ex: `storage.test.ts`, `feedback.test.ts`).
  - `utils/`: Testes da lógica pura do jogo e utilitários matemáticos (Ex: `battleSim.test.ts`, `gameMath.test.ts`).
- `tests/e2e/`: Contém os testes de fluxo de interface com o usuário geridos pelo Playwright.
  - Fluxos principais de interface (Ex: `mission_flow.spec.ts`, `training_flow.spec.ts`).

## 4. Escopo e Cobertura

### 4.1. Lógica Central (Testes Unitários)
Todas as regras de negócio devem ser cobertas por testes unitários exaustivos:
- Simulação de Batalhas (`battleSim.ts` e `battleEngine.ts`).
- Cálculos de XP, dano e recompensas (`gameMath.ts`, `missionMath.ts`, `trainingMath.ts`).
- Mudanças de Estado previsíveis (`gameReducer` e seus diferentes sub-arquivos testando ações específicas).
- Handlers do sistema (Tick Handler, System Handler).

### 4.2. Fluxos e Integração (Hooks e Contextos)
Os testes de hooks (`useGame`, `useMissions`, `useTraining`, etc.) devem focar no comportamento simulado do usuário através da interface React e como eles afetam o estado.

### 4.3. Testes E2E
Focam em garantir que a UI inteira funciona em conjunto:
- **Fluxo de Navegação Principal:** Garantir que o jogador pode mover entre Guilda, Missões, Treinamento e Enfermaria (`main_navigation.spec.ts`).
- **Drag & Drop:** Testar interações complexas de UI como alocar heróis (`drag_drop.spec.ts`).
- **Ciclo Core do Jogo:**
  - Recrutamento (`guilda_recruit.spec.ts`)
  - Envio e resgate de missões (`mission_flow.spec.ts`)
  - Treinamento (`training_flow.spec.ts`)
  - Cura na enfermaria (`infirmary_flow.spec.ts`)

## 5. Execução de Testes

No `package.json`, estão configurados os seguintes scripts:

- `npm run test`: Executa os testes unitários via Jest (usando o arquivo de configuração `jest.unit.config.js`).
- `npm run test:unit`: Executa os testes unitários de forma sequencial (`--runInBand`), ideal para debugar vazamentos de estado.
- `npm run test:all`: Executa os testes globais usando o arquivo padrão do `jest.config.js`.
- `npm run test:e2e`: Executa os testes de interface do Playwright (`playwright.config.ts`).

## 6. Padrões de Qualidade e Práticas
- **Isolamento:** Os testes unitários não devem depender de chamadas reais de sistema (ex: usar mocks para `AsyncStorage` ou temporizadores).
- **Sem Side-effects:** O estado do jogo no Reducer deve ser tratado como imutável e testes não devem afetar uns aos outros.
- **Configuração do Jest:**
  - Dependências nativas e arquivos de compilação da `expo` e de bibliotecas react-native de terceiros são ignoradas ou formatadas através do `transformIgnorePatterns`.
  - Stubs e mocks (`jest-mocks/`) são amplamente utilizados para substituir bibliotecas que falham em execução Node.
- **TDD:** (Prática Recomendada) Ao criar novas funcionalidades (como novos tipos de missões ou cálculos de atributos), deve-se iniciar pela criação de testes unitários nas pastas de `utils` e `context`.
