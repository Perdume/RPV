import React, { useState } from 'react';
import styled from 'styled-components';
import { theme } from '../styles/theme';
import { Player, PlayerAction, ActionType } from '../types/game.types';

interface TurnControlProps {
  players: Player[];
  onTurnComplete: (actions: PlayerAction[]) => void;
}

const Container = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${theme.spacing.md};
  background: ${theme.colors.background.card};
  border-radius: ${theme.borderRadius.md};
  padding: ${theme.spacing.md};
  box-shadow: ${theme.shadows.card};
`;

const InputSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
`;

const TextArea = styled.textarea`
  width: 100%;
  height: 120px;
  padding: ${theme.spacing.sm};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.sm};
  background: ${theme.colors.background.primary};
  color: ${theme.colors.text.primary};
  font-family: ${theme.fonts.mono};
  resize: vertical;

  &:focus {
    outline: none;
    border-color: ${theme.colors.accent.action};
  }
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

const ResultContainer = styled.div`
  padding: ${theme.spacing.md};
  background: ${theme.colors.background.primary};
  border-radius: ${theme.borderRadius.md};
  font-family: ${theme.fonts.mono};
  color: ${theme.colors.text.secondary};
  white-space: pre-wrap;
  border: 1px solid ${theme.colors.border};
  height: 100%;
  overflow-y: auto;
  font-size: 0.9rem;
  line-height: 1.4;

  div {
    margin-bottom: ${theme.spacing.xs};
    
    &:last-child {
      margin-bottom: 0;
    }
  }
`;

export const TurnControl: React.FC<TurnControlProps> = ({ players, onTurnComplete }) => {
  const [abilityInput, setAbilityInput] = useState('');
  const [actionInput, setActionInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const parseAbilityInput = (text: string): PlayerAction[] => {
    console.log('[DEBUG] === 능력 사용 파싱 시작 ===');
    console.log('[DEBUG] 입력 텍스트:', text);

    const lines = text.trim().split('\n');
    const actions: PlayerAction[] = [];

    lines.forEach((line, index) => {
      console.log(`[DEBUG] 라인 ${index + 1} 파싱 중:`, line);
      
      // 능력 사용 형식: [플레이어ID] -> [대상ID]
      const abilityMatch = line.match(/(\d+)\s*->\s*(\d+)?/);
      if (abilityMatch) {
        const [_, playerId, targetId] = abilityMatch;
        const action: PlayerAction = {
          playerId: parseInt(playerId),
          targetId: targetId ? parseInt(targetId) : parseInt(playerId), // 대상이 없으면 자기 자신을 대상으로
          actionType: 'ABILITY',
          abilityId: undefined // TODO: 플레이어의 abilityId 사용
        };

        console.log(`[DEBUG] 파싱된 능력 사용:`, action);
        actions.push(action);
      }
    });

    console.log('[DEBUG] === 능력 사용 파싱 완료 ===');
    console.log('[DEBUG] 파싱된 능력 사용 수:', actions.length);
    return actions;
  };

  const parseActionInput = (text: string): PlayerAction[] => {
    console.log('[DEBUG] === 행동 선언 파싱 시작 ===');
    console.log('[DEBUG] 입력 텍스트:', text);

    const lines = text.trim().split('\n');
    const actions: PlayerAction[] = [];

    lines.forEach((line, index) => {
      console.log(`[DEBUG] 라인 ${index + 1} 파싱 중:`, line);
      
      // 공격 형식: [플레이어ID] => [대상ID]
      const attackMatch = line.match(/(\d+)\s*=>\s*(\d+)/);
      if (attackMatch) {
        const [_, playerId, targetId] = attackMatch;
        const action: PlayerAction = {
          playerId: parseInt(playerId),
          targetId: parseInt(targetId),
          actionType: 'ATTACK',
          abilityId: undefined
        };
        console.log(`[DEBUG] 파싱된 공격 행동:`, action);
        actions.push(action);
        return;
      }

      // 방어 형식: [플레이어ID] Def
      const defendMatch = line.match(/(\d+)\s*Def/);
      if (defendMatch) {
        const [_, playerId] = defendMatch;
        const action: PlayerAction = {
          playerId: parseInt(playerId),
          targetId: parseInt(playerId), // 자기 자신을 대상으로
          actionType: 'DEFEND',
          abilityId: undefined
        };
        console.log(`[DEBUG] 파싱된 방어 행동:`, action);
        actions.push(action);
        return;
      }

      // 회피 형식: [플레이어ID] Evade
      const evadeMatch = line.match(/(\d+)\s*Evade/);
      if (evadeMatch) {
        const [_, playerId] = evadeMatch;
        const action: PlayerAction = {
          playerId: parseInt(playerId),
          targetId: parseInt(playerId), // 자기 자신을 대상으로
          actionType: 'DEFEND', // 회피도 방어로 처리
          abilityId: undefined
        };
        console.log(`[DEBUG] 파싱된 회피 행동:`, action);
        actions.push(action);
      }
    });

    console.log('[DEBUG] === 행동 선언 파싱 완료 ===');
    console.log('[DEBUG] 파싱된 행동 수:', actions.length);
    return actions;
  };

  const handleProcess = () => {
    console.log('[DEBUG] === 턴 처리 시작 ===');
    setIsProcessing(true);

    try {
      const abilityActions = parseAbilityInput(abilityInput);
      const actionActions = parseActionInput(actionInput);
      const allActions = [...abilityActions, ...actionActions];

      console.log('[DEBUG] 파싱된 모든 행동:', allActions);

      // 행동 검증 및 패스 처리
      const alivePlayers = players.filter(p => p.status !== 'DEAD');
      const actionPlayers = new Set(allActions.map(a => a.playerId));
      const missingPlayers = alivePlayers.filter(p => !actionPlayers.has(p.id));

      console.log('[DEBUG] 생존자 수:', alivePlayers.length);
      console.log('[DEBUG] 행동 입력 수:', actionPlayers.size);
      console.log('[DEBUG] 패스 처리할 플레이어:', missingPlayers.map(p => p.id));

      // 패스 처리를 PASS로 변경
      const passActions = missingPlayers.map(player => ({
        playerId: player.id,
        targetId: player.id,
        actionType: 'PASS' as ActionType,
        abilityId: undefined
      }));

      const finalActions = [...allActions, ...passActions];
      console.log('[DEBUG] 최종 행동 목록:', finalActions);

      // 행동 처리
      onTurnComplete(finalActions);
      setAbilityInput('');
      setActionInput('');
      setLogs([]);
      console.log('[DEBUG] === 턴 처리 완료 ===');
    } catch (error) {
      console.error('[DEBUG] 턴 처리 중 오류 발생:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      setLogs(prev => [...prev, `[오류] ${errorMessage}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Container>
      <InputSection>
        <div>
          <h3>능력 사용</h3>
          <TextArea
            value={abilityInput}
            onChange={(e) => setAbilityInput(e.target.value)}
            placeholder="1 -> 2 (플레이어 1이 플레이어 2에게 능력 사용)
3 -> (플레이어 3이 논타겟 능력 사용)"
          />
        </div>
        <div>
          <h3>행동 선언</h3>
          <TextArea
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
            placeholder="1 => 2 (플레이어 1이 플레이어 2를 공격)
3 Def (플레이어 3이 방어)
4 Evade (플레이어 4가 회피)"
          />
        </div>
        <Button 
          onClick={handleProcess} 
          disabled={isProcessing || (!abilityInput.trim() && !actionInput.trim())}
        >
          {isProcessing ? '처리 중...' : '입력 처리하기'}
        </Button>
      </InputSection>
      <ResultContainer>
        {logs.length > 0 ? (
          logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))
        ) : (
          <div>처리 결과가 여기에 표시됩니다.</div>
        )}
      </ResultContainer>
    </Container>
  );
}; 