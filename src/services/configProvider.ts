import { CLASS_DEFS, ClassDef } from '../constants/classes';
import { PERSONALITIES, PersonalityDef } from '../constants/personalities';
import { ClassId, PersonalityId } from '../types';

/**
 * Provider de Configuração (Solução Arquitetural - Sandbox)
 * 
 * Este serviço centraliza o acesso aos dados de balanceamento (Classes e Personalidades),
 * permitindo que sejam sobrescritos em tempo de execução para testes e simulações
 * sem alterar o código-fonte original.
 */
class ConfigProvider {
  private classDefs: Record<ClassId, ClassDef>;
  private personalityDefs: Record<PersonalityId, PersonalityDef>;

  constructor() {
    // Inicializa com os valores padrão definidos nos constants
    this.classDefs = { ...CLASS_DEFS };
    this.personalityDefs = { ...PERSONALITIES };
  }

  /**
   * Retorna a definição de uma classe específica.
   */
  getClassDef(classId: ClassId): ClassDef {
    return this.classDefs[classId];
  }

  /**
   * Retorna todas as definições de classes.
   */
  getAllClassDefs(): Record<ClassId, ClassDef> {
    return this.classDefs;
  }

  /**
   * Retorna a definição de uma personalidade específica.
   */
  getPersonalityDef(personalityId: PersonalityId): PersonalityDef {
    return this.personalityDefs[personalityId];
  }

  /**
   * Retorna todas as definições de personalidades.
   */
  getAllPersonalities(): Record<PersonalityId, PersonalityDef> {
    return this.personalityDefs;
  }

  /**
   * Sobrescreve as configurações atuais. 
   * Útil para o modo "Sandbox" em simulações.
   */
  overrideConfig(overrides: {
    classes?: Partial<Record<ClassId, Partial<ClassDef>>>;
    personalities?: Partial<Record<PersonalityId, Partial<PersonalityDef>>>;
  }) {
    if (overrides.classes) {
      for (const [id, def] of Object.entries(overrides.classes)) {
        const classId = id as ClassId;
        this.classDefs[classId] = {
          ...this.classDefs[classId],
          ...def,
        } as ClassDef;
      }
    }

    if (overrides.personalities) {
      for (const [id, def] of Object.entries(overrides.personalities)) {
        const personalityId = id as PersonalityId;
        this.personalityDefs[personalityId] = {
          ...this.personalityDefs[personalityId],
          ...def,
        } as PersonalityDef;
      }
    }
  }

  /**
   * Reseta as configurações para os valores originais.
   */
  reset() {
    this.classDefs = { ...CLASS_DEFS };
    this.personalityDefs = { ...PERSONALITIES };
  }
}

// Exporta uma instância única (Singleton)
export const configProvider = new ConfigProvider();
