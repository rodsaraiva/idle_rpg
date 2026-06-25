import { TargetId } from './onboardingSteps';

export interface TargetLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Measurer = () => Promise<TargetLayout | null>;

const registry = new Map<TargetId, Measurer>();

/** Registra um medidor para um alvo. Retorna função de desregistro (chamar no unmount). */
export function registerTarget(id: TargetId, measure: Measurer): () => void {
  registry.set(id, measure);
  return () => {
    // só remove se ainda for o mesmo medidor (evita apagar registro de uma remontagem mais nova)
    if (registry.get(id) === measure) registry.delete(id);
  };
}

/** Mede o alvo; null se não registrado (tela não montada) → modo ponteiro de navegação. */
export async function measureTarget(id: TargetId): Promise<TargetLayout | null> {
  const measure = registry.get(id);
  if (!measure) return null;
  return measure();
}
