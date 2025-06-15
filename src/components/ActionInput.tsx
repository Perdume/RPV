import React, { useState } from 'react';
import styled from 'styled-components';
import { theme } from '../styles/theme';
import { Player, ActionType, PlayerAction } from '../types/game.types';

interface ActionInputProps {
  players: Player[];
  onTurnComplete: (actions: PlayerAction[]) => void;
}

const Container = styled.div`
  margin-top: ${theme.spacing.lg};
  padding: ${theme.spacing.md};
  background: ${theme.colors.background.card};
  border-radius: ${theme.borderRadius.md};
  box-shadow: ${theme.shadows.card};
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
`;

const ActionRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
`;

const Label = styled.label`
  min-width: 100px;
  color: ${theme.colors.text.primary};
  font-family: ${theme.fonts.mono};
`;

const Select = styled.select`
  padding: ${theme.spacing.sm};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.sm};
  background: ${theme.colors.background.primary};
  color: ${theme.colors.text.primary};
  font-family: ${theme.fonts.mono};
  min-width: 150px;

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

export const ActionInput: React.FC<ActionInputProps> = ({ players, onTurnComplete }) => {
  const [actions, setActions] = useState<PlayerAction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const handleActionChange = (playerId: number, field: keyof PlayerAction, value: string) => {
    console.log(`[DEBUG] 행동 변경: 플레이어 ${playerId}, 필드 ${field}, 값 ${value}`);
    
    setActions(prev => {
      const existingAction = prev.find(a => a.playerId === playerId);
      if (existingAction) {
        const updatedAction = { 
          ...existingAction, 
          [field]: field === 'targetId' ? Number(value) : value 
        };
        console.log(`[DEBUG] 기존 행동 업데이트:`, updatedAction);
        return prev.map(a => 
          a.playerId === playerId ? updatedAction : a
        );
      } else {
        const newAction: PlayerAction = {
          playerId,
          targetId: Number(value),
          actionType: 'ATTACK',
          abilityId: undefined
        };
        console.log(`[DEBUG] 새로운 행동 추가:`, newAction);
        return [...prev, newAction];
      }
    });

    // 행동 선언 로그 추가
    const player = players.find(p => p.id === playerId);
    const target = players.find(p => p.id === Number(value));
    if (player && target) {
      const actionType = field === 'actionType' ? value : 'ATTACK';
      const logMessage = `[행동 선언] ${player.name}이(가) ${target.name}에게 ${actionType} 행동을 선언했습니다.`;
      console.log(`[DEBUG] ${logMessage}`);
      setLogs(prev => [...prev, logMessage]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    console.log('[DEBUG] === 턴 처리 시작 ===');
    console.log('[DEBUG] 입력된 행동:', actions);

    try {
      onTurnComplete(actions);
      setActions([]);
      setLogs([]);
      console.log('[DEBUG] === 턴 처리 완료 ===');
    } catch (error) {
      console.error('[DEBUG] 턴 처리 중 오류 발생:', error);
      alert(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const alivePlayers = players.filter(p => p.status !== 'DEAD');

  return (
    <Container>
      <Form onSubmit={handleSubmit}>
        {alivePlayers.map(player => (
          <ActionRow key={player.id}>
            <Label>{player.name}:</Label>
            <Select
              value={actions.find(a => a.playerId === player.id)?.targetId || ''}
              onChange={(e) => handleActionChange(player.id, 'targetId', e.target.value)}
              required
            >
              <option value="">대상을 선택하세요</option>
              {players
                .filter(p => p.id !== player.id && p.status !== 'DEAD')
                .map(target => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
            </Select>
            <Select
              value={actions.find(a => a.playerId === player.id)?.actionType || ''}
              onChange={(e) => handleActionChange(player.id, 'actionType', e.target.value as ActionType)}
              required
            >
              <option value="">행동을 선택하세요</option>
              <option value="ATTACK">공격</option>
              <option value="DEFEND">방어</option>
              <option value="ABILITY">능력</option>
            </Select>
            {actions.find(a => a.playerId === player.id)?.actionType === 'ABILITY' && (
              <Select
                value={actions.find(a => a.playerId === player.id)?.abilityId || ''}
                onChange={(e) => handleActionChange(player.id, 'abilityId', e.target.value)}
                required
              >
                <option value="">능력을 선택하세요</option>
                <option value={player.abilityId}>{player.abilityId}</option>
              </Select>
            )}
          </ActionRow>
        ))}
        <Button type="submit" disabled={isProcessing || actions.length !== alivePlayers.length}>
          {isProcessing ? '처리 중...' : '입력 처리하기'}
        </Button>
      </Form>
      <div style={{ marginTop: theme.spacing.md }}>
        {logs.map((log, index) => (
          <div key={index} style={{ color: theme.colors.text.secondary, fontFamily: theme.fonts.mono }}>
            {log}
          </div>
        ))}
      </div>
    </Container>
  );
}; 