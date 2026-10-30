import React from 'react';
import styled from 'styled-components';
import { theme } from '../styles/theme';
import { PlayerTable } from './PlayerTable';
import { Player, PlayerStatus } from '../types/game.types';
import { DEATH_ZONE_INTERVAL, EXTREME_MAX_SURVIVORS, EXTREME_START_TURN } from '../utils/turnProcessor';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: ${theme.spacing.md};
  gap: ${theme.spacing.md};
`;

const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${theme.spacing.md};
  background: ${theme.colors.background.card};
  border-radius: ${theme.borderRadius.md};
  box-shadow: ${theme.shadows.card};
`;

const Title = styled.h1`
  font-size: ${theme.typography.h1.size};
  font-weight: ${theme.typography.h1.weight};
  color: ${theme.colors.text.primary};
`;

const GameInfo = styled.div`
  display: flex;
  gap: ${theme.spacing.lg};
  color: ${theme.colors.text.secondary};
`;

const MainContent = styled.main`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${theme.spacing.md};
  flex: 1;
`;

const PlayerTableSection = styled.section`
  background: ${theme.colors.background.card};
  border-radius: ${theme.borderRadius.md};
  padding: ${theme.spacing.md};
  box-shadow: ${theme.shadows.card};
  overflow-x: auto;
  min-width: 0;
`;

const TurnControlSection = styled.section`
  background: ${theme.colors.background.card};
  border-radius: ${theme.borderRadius.md};
  padding: ${theme.spacing.md};
  box-shadow: ${theme.shadows.card};
  min-width: 0;
`;

const ExtremeBadge = styled.span`
  color: ${theme.colors.accent.danger};
  font-weight: 600;
`;

interface LayoutProps {
  children?: React.ReactNode;
  players?: Player[];
  currentTurn?: number; // 이번에 진행할 턴
  controls?: React.ReactNode; // 오른쪽 패널 (행동 입력 등)
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  players = [], 
  currentTurn = 1,
  controls
}) => {
  const aliveCount = players.filter(p => p.status !== PlayerStatus.DEAD).length;
  // 데스존: 매 5턴 종료시 최대 체력 1 감소
  const deathZoneReductions = Math.floor(Math.max(0, currentTurn - 1) / DEATH_ZONE_INTERVAL);
  const nextDeathZoneTurn = (deathZoneReductions + 1) * DEATH_ZONE_INTERVAL;
  const isExtreme = currentTurn >= EXTREME_START_TURN && aliveCount <= EXTREME_MAX_SURVIVORS;

  return (
    <Container>
      <Header>
        <Title>🎮 Numbers Game Master Console</Title>
        <GameInfo>
          <span>턴: {currentTurn}</span>
          <span>참가: {players.length}명</span>
          <span>생존: {players.filter(p => p.status === PlayerStatus.ALIVE).length}명</span>
          <span>부상: {players.filter(p => p.status === PlayerStatus.WOUNDED).length}명</span>
          <span>탈락: {players.filter(p => p.status === PlayerStatus.DEAD).length}명</span>
          <span>데스존: 최대 체력 -{deathZoneReductions} (턴 {nextDeathZoneTurn} 종료시 감소)</span>
          {isExtreme && <ExtremeBadge>극한</ExtremeBadge>}
        </GameInfo>
      </Header>
      <MainContent>
        <PlayerTableSection>
          <PlayerTable players={players} />
        </PlayerTableSection>
        <TurnControlSection>
          {controls}
        </TurnControlSection>
      </MainContent>
      {children}
    </Container>
  );
}; 