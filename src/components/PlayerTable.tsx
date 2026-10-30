import React from 'react';
import styled from 'styled-components';
import { theme } from '../styles/theme';
import { Player, PlayerStatus, StatusEffect } from '../types/game.types';
import { formatStatusEffect } from '../utils/StatusEffectManager';

interface PlayerTableProps {
  players: Player[];
}

const Table = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-family: ${theme.fonts.mono};
  font-size: ${theme.typography.code.size};
  color: ${theme.colors.text.primary};
`;

const Th = styled.th`
  text-align: left;
  padding: ${theme.spacing.md};
  border-bottom: 2px solid ${theme.colors.background.secondary};
  font-weight: ${theme.typography.h2.weight};
  color: ${theme.colors.text.secondary};
  white-space: nowrap;
`;

const Td = styled.td`
  padding: ${theme.spacing.md};
  border-bottom: 1px solid ${theme.colors.background.secondary};
  vertical-align: middle;
`;

const Tr = styled.tr<{ status: PlayerStatus }>`
  color: ${props => {
    switch (props.status) {
      case PlayerStatus.DEAD: return theme.colors.status.dead;
      default: return theme.colors.text.primary;
    }
  }};
  opacity: ${props => props.status === PlayerStatus.DEAD ? 0.5 : 1};
  text-decoration: ${props => props.status === PlayerStatus.DEAD ? 'line-through' : 'none'};
  transition: ${theme.transitions.default};

  &:hover {
    background: ${theme.colors.background.secondary};
  }
`;

const StatusBadge = styled.span<{ status: PlayerStatus }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: ${theme.borderRadius.sm};
  font-size: 0.9em;
  font-weight: 500;
  background: ${props => {
    switch (props.status) {
      case PlayerStatus.ALIVE: return `${theme.colors.status.alive}20`;
      case PlayerStatus.WOUNDED: return `${theme.colors.status.wounded}20`;
      case PlayerStatus.DEAD: return `${theme.colors.status.dead}20`;
      default: return theme.colors.background.secondary;
    }
  }};
  color: ${props => {
    switch (props.status) {
      case PlayerStatus.ALIVE: return theme.colors.status.alive;
      case PlayerStatus.WOUNDED: return theme.colors.status.wounded;
      case PlayerStatus.DEAD: return theme.colors.status.dead;
      default: return theme.colors.text.secondary;
    }
  }};
  border: 1px solid ${props => {
    switch (props.status) {
      case PlayerStatus.ALIVE: return theme.colors.status.alive;
      case PlayerStatus.WOUNDED: return theme.colors.status.wounded;
      case PlayerStatus.DEAD: return theme.colors.status.dead;
      default: return theme.colors.background.secondary;
    }
  }};
`;

const AbilityBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: ${theme.borderRadius.sm};
  font-size: 0.9em;
  font-weight: 500;
  background: ${theme.colors.accent.survivor}20;
  color: ${theme.colors.accent.survivor};
  border: 1px solid ${theme.colors.accent.survivor};
`;

const StatusEffectBadge = styled.span<{ type: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: ${theme.borderRadius.sm};
  font-size: 0.9em;
  font-weight: 500;
  margin-right: 6px;
  background: ${props => {
    switch (props.type) {
      case 'buff': return `${theme.colors.accent.survivor}20`;
      case 'debuff': return `${theme.colors.accent.danger}20`;
      case 'neutral': return `${theme.colors.accent.warning}20`;
      default: return `${theme.colors.accent.warning}20`;
    }
  }};
  color: ${props => {
    switch (props.type) {
      case 'buff': return theme.colors.accent.survivor;
      case 'debuff': return theme.colors.accent.danger;
      case 'neutral': return theme.colors.accent.warning;
      default: return theme.colors.accent.warning;
    }
  }};
  border: 1px solid ${props => {
    switch (props.type) {
      case 'buff': return theme.colors.accent.survivor;
      case 'debuff': return theme.colors.accent.danger;
      case 'neutral': return theme.colors.accent.warning;
      default: return theme.colors.accent.warning;
    }
  }};
`;

const HealthBar = styled.div<{ value: number; max: number }>`
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  
  &::before {
    content: '❤️'.repeat(${props => props.value});
  }
  
  &::after {
    content: '🤍'.repeat(${props => props.max - props.value});
  }
`;

const DefenseBar = styled.div<{ value: number; max: number }>`
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  
  &::before {
    content: '🛡️'.repeat(${props => props.value});
  }
  
  &::after {
    content: '⚪'.repeat(${props => props.max - props.value});
  }
`;

const EvasionBar = styled.div<{ value: number }>`
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  
  &::before {
    content: '💨'.repeat(${props => props.value});
  }
`;

const AbilityCell = styled.td`
  font-family: ${theme.fonts.mono};
  color: ${theme.colors.text.secondary};
  padding: ${theme.spacing.sm};
  text-align: left;
  border-bottom: 1px solid ${theme.colors.border};
`;

const AbilityText = styled.span<{ $isZero: boolean }>`
  color: ${props => props.$isZero ? theme.colors.accent.danger : theme.colors.text.secondary};
`;

const getStatusEffectType = (effect: StatusEffect): string => {
  return effect.type || 'neutral';
};

export const PlayerTable: React.FC<PlayerTableProps> = ({ players }) => {
  return (
    <Table>
      <thead>
        <tr>
          <Th>ID</Th>
          <Th>이름</Th>
          <Th>HP</Th>
          <Th>방어</Th>
          <Th>회피</Th>
          <Th>능력</Th>
          <Th>상태</Th>
          <Th>상태이상</Th>
        </tr>
      </thead>
      <tbody>
        {players.map(player => (
          <Tr key={player.id} status={player.status}>
            <Td>{player.id}</Td>
            <Td>{player.name}</Td>
            <Td>{`${player.hp}/${player.maxHp}`}</Td>
            <Td>{`${player.defenseGauge}/${player.maxDefenseGauge}`}</Td>
            <Td>{player.evadeCount}</Td>
            <Td>
              <AbilityText $isZero={player.abilityUses === 0}>
                {player.ability} ({player.abilityUses})
              </AbilityText>
            </Td>
            <Td>
              <StatusBadge status={player.status}>
                {player.status === PlayerStatus.ALIVE && '🟢 생존'}
                {player.status === PlayerStatus.DEAD && '💀 사망'}
              </StatusBadge>
            </Td>
            <Td>
              {player.statusEffects.map((effect, index) => (
                <StatusEffectBadge key={index} type={getStatusEffectType(effect)}>
                  {formatStatusEffect(effect)}
                </StatusEffectBadge>
              ))}
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}; 