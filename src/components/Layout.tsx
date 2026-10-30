import React from 'react';
import styled from 'styled-components';
import { theme } from '../styles/theme';
import { PlayerTable } from './PlayerTable';
import { TurnControl } from './TurnControl';
import { Player, PlayerStatus, PlayerAction } from '../types/game.types';

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

// 헤더에 표시할 게임 정보 (App에서 불러온 data.json을 그대로 전달받음)
interface HeaderGameData {
  turn: number;
  deathZone: {
    stage: number;
    nextReduction: number;
  };
}

interface LayoutProps {
  children?: React.ReactNode;
  players?: Player[];
  gameData?: HeaderGameData | null;
  currentTurn?: number;
  onTurnComplete?: (actions: PlayerAction[]) => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  players = [], 
  gameData = null,
  currentTurn,
  onTurnComplete = () => {} 
}) => {
  return (
    <Container>
      <Header>
        <Title>🎮 Numbers Game Master Console</Title>
        <GameInfo>
          <span>턴: {currentTurn ?? gameData?.turn ?? 0}</span>
          <span>참가: {players.length}명</span>
          <span>생존: {players.filter(p => p.status === PlayerStatus.ALIVE).length}명</span>
          <span>부상: {players.filter(p => p.status === PlayerStatus.WOUNDED).length}명</span>
          <span>탈락: {players.filter(p => p.status === PlayerStatus.DEAD).length}명</span>
          <span>데스존: {gameData?.deathZone.stage ?? 1}단계 (턴{gameData?.deathZone.nextReduction ?? 10})</span>
        </GameInfo>
      </Header>
      <MainContent>
        <PlayerTableSection>
          <PlayerTable players={players} />
        </PlayerTableSection>
        <TurnControlSection>
          <TurnControl 
            players={players}
            onTurnComplete={onTurnComplete}
          />
        </TurnControlSection>
      </MainContent>
      {children}
    </Container>
  );
}; 