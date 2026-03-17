/**
 * AbilityRegistry — 능력 자동 등록 시스템
 *
 * 능력 파일 하나당 파일 맨 아래에 한 줄만 추가하면
 * AbilityManager 등 다른 메인 코드를 수정하지 않고도 능력이 등록됩니다.
 *
 * 사용법 (각 능력 파일 맨 아래에 추가):
 *   import { AbilityRegistry } from './AbilityRegistry';
 *   AbilityRegistry.register('abilityId', () => new MyAbility(), ['한글 별칭']);
 *
 * 새 능력 추가 방법:
 *   1. src/abilities/MyAbility.ts 파일 작성 (BaseAbility 상속)
 *   2. 파일 맨 아래에 AbilityRegistry.register(...) 한 줄 추가
 *   3. src/abilities/index.ts 에 import './MyAbility' 한 줄 추가
 *   → 다른 메인 코드(AbilityManager 등)는 수정 불필요
 */

// AbilityRegistry는 순환 의존성을 피하기 위해 다른 모듈을 import하지 않습니다.
type AbilityFactory = () => any;

// 정식 ID → 팩토리 함수
const _factories = new Map<string, AbilityFactory>();

// 별칭(한글 이름 등) → 정식 ID
const _aliasMap = new Map<string, string>();

export const AbilityRegistry = {
  /**
   * 능력을 레지스트리에 등록합니다.
   * @param id    정식 능력 ID (예: 'multipleStrike')
   * @param factory  능력 인스턴스를 생성하는 팩토리 함수
   * @param aliases  한글 이름 등 별칭 목록 (예: ['다중 타격'])
   */
  register(id: string, factory: AbilityFactory, aliases: string[] = []): void {
    _factories.set(id, factory);
    for (const alias of aliases) {
      _aliasMap.set(alias, id);
    }
  },

  /**
   * 등록된 모든 능력의 새 인스턴스를 생성하여 Map으로 반환합니다.
   * AbilityManager의 registerDefaultAbilities()에서 사용합니다.
   */
  createAll(): Map<string, any> {
    const result = new Map<string, any>();
    for (const [id, factory] of _factories.entries()) {
      result.set(id, factory());
    }
    return result;
  },

  /**
   * 별칭이나 ID를 정식 ID로 변환합니다.
   * 등록된 별칭이 없으면 원래 값을 그대로 반환합니다.
   */
  resolveAlias(idOrAlias: string): string {
    return _aliasMap.get(idOrAlias) ?? idOrAlias;
  },

  /**
   * 등록된 정식 ID 목록을 반환합니다.
   */
  getIds(): string[] {
    return Array.from(_factories.keys());
  },
} as const;
