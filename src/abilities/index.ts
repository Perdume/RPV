/**
 * src/abilities/index.ts
 *
 * 능력 자동 등록 진입점입니다.
 * 이 파일을 import하면 아래 모든 능력이 AbilityRegistry에 등록됩니다.
 *
 * 새 능력을 추가하는 방법:
 *   1. src/abilities/MyNewAbility.ts 파일을 작성합니다 (BaseAbility 상속).
 *   2. 파일 맨 아래에 AbilityRegistry.register(...) 한 줄을 추가합니다.
 *   3. 아래에 import './MyNewAbility'; 한 줄을 추가합니다.
 *   → AbilityManager 등 다른 메인 코드는 수정하지 않아도 됩니다.
 */

// 게임 능력들
import './MultipleStrike';
import './SniperRifle';
import './Quantumization';
import './SwiftCounter';
import './Alzheimer';
import './Judge';
import './Synchronize';
import './GhostSummoning';
import './Confusion';
import './WeaponBreak';
import './PreemptivePrediction';
import './DiscordDissonance';
import './EndOfDestruction';
import './GreatFailure';
import './LiveToDie';
import './PainfulMemory';
import './ShadowInDarkness';
import './WoundAnalysis';
import './TargetManipulation';
import './SuppressedFreedom';
import './Unseeable';
import './WillLoss';
import './FallenCrown';
import './FateCross';
import './BurningEmbers';
import './Annihilation';
import './PlayingDead';
import './FateExchange';
import './RisingAshes';

// 디버그 능력들
import './Debug';
import './DebugLogger';
