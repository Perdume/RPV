import React, { useState } from 'react';
import styled from 'styled-components';
import { theme } from '../styles/theme';
import { Player, PlayerAction, PlayerStatus } from '../types/game.types';
import { FATE_CROSS_TURN_FLAG } from '../utils/turnProcessor';

type BasicAction = 'ATTACK' | 'DEFEND' | 'EVADE' | 'PASS';

// 플레이어별 입력 상태
interface PlayerDraft {
  action: BasicAction;
  targetId?: number;          // 공격 대상
  useAbility: boolean;
  abilityTargetId?: number;   // 지정하지 않으면 대상 없음
  abilityInput: string;       // 능력 로그의 추가 입력 (<?>)
  fateCrossTargetId?: number; // 초반 보호로 얻은 운명 교차 대상
}

interface ActionInputProps {
  players: Player[];
  currentTurn: number;
  onTurnComplete: (actions: PlayerAction[]) => Promise<void> | void;
}

const ACTION_OPTIONS: Array<{ value: BasicAction; label: string }> = [
  { value: 'ATTACK', label: '공격' },
  { value: 'DEFEND', label: '방어' },
  { value: 'EVADE', label: '회피' },
  { value: 'PASS', label: '패스' }
];

const EMPTY_DRAFT: PlayerDraft = { action: 'PASS', useAbility: false, abilityInput: '' };

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
`;

const Heading = styled.h3`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0;
  color: ${theme.colors.text.primary};
`;

const TurnBadge = styled.span`
  font-family: ${theme.fonts.mono};
  font-size: ${theme.typography.body2.size};
  color: ${theme.colors.accent.action};
`;

const PlayerCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.sm};
  background: ${theme.colors.background.primary};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.sm};
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${theme.spacing.sm};
`;

const PlayerLabel = styled.span`
  min-width: 110px;
  color: ${theme.colors.text.primary};
  font-family: ${theme.fonts.mono};
`;

const Select = styled.select`
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.sm};
  background: ${theme.colors.background.secondary};
  color: ${theme.colors.text.primary};
  font-family: ${theme.fonts.mono};

  &:disabled {
    opacity: 0.4;
  }
`;

const TextInput = styled.input`
  flex: 1;
  min-width: 100px;
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.sm};
  background: ${theme.colors.background.secondary};
  color: ${theme.colors.text.primary};
  font-family: ${theme.fonts.mono};
`;

const CheckboxLabel = styled.label<{ $disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  color: ${props => props.$disabled ? theme.colors.text.secondary : theme.colors.text.primary};
  font-size: ${theme.typography.body2.size};
`;

const LogPreview = styled.pre`
  margin: 0;
  padding: ${theme.spacing.sm};
  background: ${theme.colors.background.primary};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.sm};
  color: ${theme.colors.text.code};
  font-family: ${theme.fonts.mono};
  font-size: ${theme.typography.code.size};
  white-space: pre-wrap;
`;

const ErrorText = styled.div`
  color: ${theme.colors.accent.danger};
  font-size: ${theme.typography.body2.size};
`;

const Button = styled.button`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.accent.action};
  color: white;
  border: none;
  border-radius: ${theme.borderRadius.sm};
  font-family: ${theme.fonts.mono};
  cursor: pointer;
  transition: ${theme.transitions.default};

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${theme.shadows.hover};
  }

  &:disabled {
    background: ${theme.colors.background.secondary};
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const canDefend = (player: Player): boolean => player.defenseGauge > 0 && !player.isDefenseSealed;

// 능력 봉인 중에는 사용 불가 (양자화는 봉인 상태에서도 사용 가능)
const canUseAbility = (player: Player): boolean =>
  !!player.abilityId && player.abilityUses > 0 && (!player.isAbilitySealed || player.abilityId === 'quantumization');

const hasFateCross = (player: Player, turn: number): boolean =>
  player.customFlags?.get(FATE_CROSS_TURN_FLAG) === turn;

const playerLabel = (player: Player): string =>
  `#${player.id} ${player.name}${player.status === PlayerStatus.DEAD ? ' (탈락)' : ''}`;

const parseOptionalNumber = (value: string): number | undefined => value === '' ? undefined : Number(value);

// 입력 상태를 엔진 행동으로 변환 (능력이 기본 행동보다 먼저 처리되도록 앞에 둠)
function buildActions(alivePlayers: Player[], drafts: Record<number, PlayerDraft>, currentTurn: number): PlayerAction[] {
  const abilityActions: PlayerAction[] = [];
  const basicActions: PlayerAction[] = [];

  for (const player of alivePlayers) {
    const draft = drafts[player.id] ?? EMPTY_DRAFT;

    if (hasFateCross(player, currentTurn) && draft.fateCrossTargetId !== undefined) {
      abilityActions.push({ playerId: player.id, targetId: draft.fateCrossTargetId, actionType: 'ABILITY', abilityId: 'fateCross' });
    }

    if (draft.useAbility && canUseAbility(player)) {
      abilityActions.push({
        playerId: player.id,
        targetId: draft.abilityTargetId ?? player.id,
        untargeted: draft.abilityTargetId === undefined,
        actionType: 'ABILITY',
        abilityId: player.abilityId,
        abilityInput: draft.abilityInput.trim() || undefined
      });
    }

    basicActions.push({
      playerId: player.id,
      targetId: draft.action === 'ATTACK' && draft.targetId !== undefined ? draft.targetId : player.id,
      actionType: draft.action
    });
  }

  return [...abilityActions, ...basicActions];
}

// 위키 로그 규칙 형식: 공격 <id> => <id> / 방어 <id> Def / 회피 <id> Evade / 능력 <id> -> <id>, <?>
function formatLogLine(action: PlayerAction): string | null {
  switch (action.actionType) {
    case 'ATTACK':
      return `${action.playerId} => ${action.targetId}`;
    case 'DEFEND':
      return `${action.playerId} Def`;
    case 'EVADE':
      return `${action.playerId} Evade`;
    case 'ABILITY': {
      const target = action.untargeted ? '' : ` ${action.targetId}`;
      const extra = action.abilityId === 'fateCross' ? '운명 교차' : action.abilityInput;
      return `${action.playerId} ->${target}${extra ? `, ${extra}` : ''}`;
    }
    default:
      return null;
  }
}

export const ActionInput: React.FC<ActionInputProps> = ({ players, currentTurn, onTurnComplete }) => {
  const [drafts, setDrafts] = useState<Record<number, PlayerDraft>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const alivePlayers = players.filter(p => p.status !== PlayerStatus.DEAD);

  const updateDraft = (playerId: number, changes: Partial<PlayerDraft>) => {
    setDrafts(prev => ({ ...prev, [playerId]: { ...(prev[playerId] ?? EMPTY_DRAFT), ...changes } }));
  };

  const actions = buildActions(alivePlayers, drafts, currentTurn);

  const missingTargets = alivePlayers.filter(player => {
    const draft = drafts[player.id];
    return draft?.action === 'ATTACK' && draft.targetId === undefined;
  });
  const validationError = missingTargets.length > 0
    ? `공격 대상을 선택하세요: ${missingTargets.map(p => `#${p.id}`).join(', ')}`
    : null;

  const logLines = actions.map(formatLogLine).filter((line): line is string => line !== null);

  const handleSubmit = async () => {
    if (validationError) return;

    setIsProcessing(true);
    setSubmitError(null);
    try {
      await onTurnComplete(actions);
      setDrafts({});
    } catch (error) {
      console.error('[행동 입력] 턴 처리 중 오류 발생:', error);
      setSubmitError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Container>
      <Heading>
        행동 입력
        <TurnBadge>턴 {currentTurn}</TurnBadge>
      </Heading>

      {alivePlayers.map(player => {
        const draft = drafts[player.id] ?? EMPTY_DRAFT;
        const attackTargets = alivePlayers.filter(p => p.id !== player.id);
        const abilityUsable = canUseAbility(player);
        const abilityLabel = player.abilityId
          ? `능력: ${player.ability} (${player.abilityUses}회)`
          : '능력 없음';

        return (
          <PlayerCard key={player.id}>
            <Row>
              <PlayerLabel>{playerLabel(player)}</PlayerLabel>
              <Select
                aria-label={`${player.name} 행동`}
                value={draft.action}
                onChange={(e) => updateDraft(player.id, { action: e.target.value as BasicAction })}
              >
                {ACTION_OPTIONS.map(option => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.value === 'DEFEND' && !canDefend(player)}
                  >
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select
                aria-label={`${player.name} 공격 대상`}
                value={draft.targetId ?? ''}
                disabled={draft.action !== 'ATTACK'}
                onChange={(e) => updateDraft(player.id, { targetId: parseOptionalNumber(e.target.value) })}
              >
                <option value="">공격 대상</option>
                {attackTargets.map(target => (
                  <option key={target.id} value={target.id}>{playerLabel(target)}</option>
                ))}
              </Select>
            </Row>

            <Row>
              <CheckboxLabel $disabled={!abilityUsable}>
                <input
                  type="checkbox"
                  checked={draft.useAbility && abilityUsable}
                  disabled={!abilityUsable}
                  onChange={(e) => updateDraft(player.id, { useAbility: e.target.checked })}
                />
                {abilityLabel}
              </CheckboxLabel>
              {draft.useAbility && abilityUsable && (
                <>
                  <Select
                    aria-label={`${player.name} 능력 대상`}
                    value={draft.abilityTargetId ?? ''}
                    onChange={(e) => updateDraft(player.id, { abilityTargetId: parseOptionalNumber(e.target.value) })}
                  >
                    <option value="">대상 없음</option>
                    {players.map(target => (
                      <option key={target.id} value={target.id}>{playerLabel(target)}</option>
                    ))}
                  </Select>
                  <TextInput
                    aria-label={`${player.name} 능력 추가 입력`}
                    placeholder="추가 입력 (예: 예측 내용)"
                    value={draft.abilityInput}
                    onChange={(e) => updateDraft(player.id, { abilityInput: e.target.value })}
                  />
                </>
              )}
            </Row>

            {hasFateCross(player, currentTurn) && (
              <Row>
                <CheckboxLabel>운명 교차 (초반 보호)</CheckboxLabel>
                <Select
                  aria-label={`${player.name} 운명 교차 대상`}
                  value={draft.fateCrossTargetId ?? ''}
                  onChange={(e) => updateDraft(player.id, { fateCrossTargetId: parseOptionalNumber(e.target.value) })}
                >
                  <option value="">사용 안 함</option>
                  {attackTargets.map(target => (
                    <option key={target.id} value={target.id}>{playerLabel(target)}</option>
                  ))}
                </Select>
              </Row>
            )}
          </PlayerCard>
        );
      })}

      <LogPreview>{logLines.length > 0 ? logLines.join('\n') : '입력된 행동이 없습니다. (모두 패스)'}</LogPreview>
      {(validationError || submitError) && <ErrorText>{validationError ?? submitError}</ErrorText>}
      <Button onClick={handleSubmit} disabled={isProcessing || !!validationError || alivePlayers.length === 0}>
        {isProcessing ? '처리 중...' : '턴 처리하기'}
      </Button>
    </Container>
  );
};
