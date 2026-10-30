import React, { useState } from 'react';
import styled from 'styled-components';
import { theme } from '../styles/theme';
import { Player } from '../types/game.types';
import { EarlyProtectionChoice } from '../utils/turnProcessor';

interface EarlyProtectionPanelProps {
  candidates: Player[];
  abilityOptions: Array<{ id: string; name: string }>;
  onChoose: (playerId: number, choice: EarlyProtectionChoice) => void;
}

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
  margin-bottom: ${theme.spacing.md};
  padding: ${theme.spacing.sm};
  border: 1px solid ${theme.colors.accent.warning};
  border-radius: ${theme.borderRadius.sm};
  background: ${theme.colors.background.primary};
`;

const Heading = styled.h3`
  margin: 0;
  color: ${theme.colors.accent.warning};
`;

const Description = styled.p`
  margin: 0;
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.body2.size};
`;

const CandidateRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${theme.spacing.sm};
`;

const CandidateLabel = styled.span`
  min-width: 140px;
  color: ${theme.colors.text.primary};
  font-family: ${theme.fonts.mono};
`;

const Select = styled.select`
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.sm};
  background: ${theme.colors.background.secondary};
  color: ${theme.colors.text.primary};
`;

const Button = styled.button`
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  background: ${theme.colors.accent.warning};
  color: ${theme.colors.background.primary};
  border: none;
  border-radius: ${theme.borderRadius.sm};
  cursor: pointer;

  &:disabled {
    background: ${theme.colors.background.secondary};
    cursor: not-allowed;
  }
`;

// 초반 보호: 2턴 안에 체력이 3 이하로 감소한 플레이어의 선택지를 GM이 입력
export const EarlyProtectionPanel: React.FC<EarlyProtectionPanelProps> = ({ candidates, abilityOptions, onChoose }) => {
  const [selectedAbilities, setSelectedAbilities] = useState<Record<number, string>>({});

  if (candidates.length === 0) {
    return null;
  }

  return (
    <Panel>
      <Heading>초반 보호 선택</Heading>
      <Description>
        체력을 5까지 회복하고 다음 턴에 한해 운명 교차를 사용하거나, 특수형 능력 중 하나로 교체합니다.
      </Description>
      {candidates.map(player => {
        const abilityId = selectedAbilities[player.id] ?? abilityOptions[0]?.id ?? '';
        return (
          <CandidateRow key={player.id}>
            <CandidateLabel>#{player.id} {player.name} (체력 {player.hp}/{player.maxHp})</CandidateLabel>
            <Button onClick={() => onChoose(player.id, { type: 'heal' })}>체력 5 회복 + 운명 교차</Button>
            <Select
              aria-label={`${player.name} 교체할 능력`}
              value={abilityId}
              onChange={(e) => setSelectedAbilities(prev => ({ ...prev, [player.id]: e.target.value }))}
            >
              {abilityOptions.map(option => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </Select>
            <Button disabled={!abilityId} onClick={() => onChoose(player.id, { type: 'replace', abilityId })}>
              능력 교체
            </Button>
          </CandidateRow>
        );
      })}
    </Panel>
  );
};
