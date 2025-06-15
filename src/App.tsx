import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { theme } from './styles/theme';
import { PlayerTable } from './components/PlayerTable';
import { ActionInput } from './components/ActionInput';
import { Player, PlayerAction, PlayerStatus, GameState, TurnResult } from './types/game.types';
import { Layout } from './components/Layout';
import { GlobalStyle } from './styles/GlobalStyle';
import { TurnProcessor } from './utils/turnProcessor';
import { TurnControl } from './components/TurnControl';
import { EventSystem } from './EventSystem';
import { AbilityManager } from './abilities/AbilityManager';
import { useEventTesting } from './utils/manualEventTest';

interface GameData {
  turn: number;
  survivors: number;
  deathZone: {
    stage: number;
    maxHpReduction: number;
    nextReduction: number;
  };
  players: {
    name: string;
    id: number;
    hp: number;
    maxHp: number;
    attack: number;
    defenseGauge: number;
    maxDefenseGauge: number;
    evadeCount: number;
    ability: string;
    abilityUses: number;
    status: string;
    statusEffects: string[];
    pendingDefenseHeal: number;
    maxAbilityUses: number;
  }[];
}

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: ${theme.spacing.lg};
`;

const Title = styled.h1`
  color: ${theme.colors.text.primary};
  font-family: ${theme.fonts.mono};
  margin-bottom: ${theme.spacing.lg};
`;

const LogContainer = styled.div`
  margin-top: ${theme.spacing.lg};
  padding: ${theme.spacing.md};
  background: ${theme.colors.background.secondary};
  border-radius: ${theme.borderRadius.md};
  font-family: ${theme.fonts.mono};
  color: ${theme.colors.text.secondary};
  max-height: 300px;
  overflow-y: auto;
`;

const LogEntry = styled.div`
  margin-bottom: ${theme.spacing.xs};
  font-size: ${theme.typography.body.size};
`;

const App: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [isDeathZone, setIsDeathZone] = useState(false);
  const [eventSystem] = useState(() => new EventSystem());
  const [abilityManager] = useState(() => new AbilityManager(eventSystem));
  const { runEventTest, runDebugTest, runCombatTest } = useEventTesting();

  useEffect(() => {
    const loadGameData = async () => {
      try {
        const response = await fetch('/Data/data.json');
        if (!response.ok) {
          throw new Error('데이터를 불러오는데 실패했습니다.');
        }
        const data: GameData = await response.json();
        
        setGameData(data);
        setCurrentTurn(data.turn);
        const newPlayers = data.players.map(p => ({
          id: p.id,
          name: p.name,
          hp: p.hp,
          maxHp: p.maxHp,
          defenseGauge: p.defenseGauge,
          maxDefenseGauge: p.maxDefenseGauge,
          evadeCount: p.evadeCount,
          abilityId: p.ability.toLowerCase().replace(/\s+/g, ''),
          status: p.status.toUpperCase() as PlayerStatus,
          statusEffects: p.statusEffects,
          isPerfectGuard: false,
          defense: 0,
          maxDefense: 3,
          evasion: 0,
          attack: p.attack,
          ability: p.ability,
          abilityUses: p.abilityUses,
          maxAbilityUses: p.maxAbilityUses,
          pendingDefenseHeal: p.pendingDefenseHeal,
          hasDefended: false,
          wasAttacked: false,
          isAbilitySealed: false,
          isDefenseSealed: false,
          damageReduction: 0,
          isGhost: false,
          targetId: undefined,
          actionType: undefined,
          noDamageTurns: 0,
          inactiveTurns: 0,
          currentTurn: data.turn
        }));

        // 능력 등록
        newPlayers.forEach(player => {
          if (player.abilityId) {
            abilityManager.assignAbility(player.id, player.abilityId);
          }
        });

        setPlayers(newPlayers);
      } catch (error) {
        console.error('게임 데이터 로드 실패:', error);
      }
    };

    loadGameData();
  }, [abilityManager]);

  const handleTurnComplete = (result: TurnResult) => {
    console.log('[DEBUG] === 턴 처리 결과 ===');
    console.log('[DEBUG] 턴 번호:', result.turnNumber);
    console.log('[DEBUG] 행동 수:', result.actions.length);
    console.log('[DEBUG] 로그 수:', result.logs.length);
    console.log('[DEBUG] 생존자 수:', result.players.filter(p => p.status !== PlayerStatus.DEAD).length);
    console.log('[DEBUG] 데스존 상태:', result.isDeathZone ? '활성화' : '비활성화');
    console.log('[DEBUG] 행동 목록:', result.actions.map(a => 
      `${a.playerId} -> ${a.targetId} (${a.actionType})`
    ));
    console.log('[DEBUG] 플레이어 상태:', result.players.map(p => 
      `${p.name}: HP ${p.hp}/${p.maxHp}, 방어 ${p.defenseGauge}/${p.maxDefenseGauge}, 회피 ${p.evadeCount}`
    ));
    
    setPlayers(result.players);
    setLogs(prev => [...prev, ...result.logs]);
    setCurrentTurn(result.turnNumber);
    setIsDeathZone(result.isDeathZone);
  };

  const handleActionSubmit = async (actions: PlayerAction[]) => {
    console.log('[DEBUG] === 턴 처리 시작 ===');
    console.log('[DEBUG] 입력된 행동:', actions);

    const gameState: GameState = {
      players,
      currentTurn,
      logs,
      isDeathZone
    };

    const turnProcessor = new TurnProcessor(gameState, eventSystem);
    const result = await turnProcessor.processTurn(actions);
    handleTurnComplete(result);
  };

  return (
    <>
      <GlobalStyle />
      <Layout 
        players={players}
        onTurnComplete={handleActionSubmit}
      >
        <Container>
          <Title>Numbers Game</Title>
          <PlayerTable players={players} />
          <ActionInput 
            players={players} 
            onTurnComplete={handleActionSubmit}
          />
          <TurnControl
            players={players}
            onTurnComplete={handleActionSubmit}
          />
          <LogContainer>
            {logs.map((log, index) => (
              <LogEntry key={index}>{log}</LogEntry>
            ))}
          </LogContainer>
        </Container>
      </Layout>
      
      {/* 개발용 테스트 버튼들 */}
      <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 1000 }}>
        <button 
          onClick={runEventTest}
          style={{
            padding: '8px 16px',
            margin: '4px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🧪 이벤트 테스트
        </button>
        <button 
          onClick={runDebugTest}
          style={{
            padding: '8px 16px',
            margin: '4px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🐛 디버그 테스트
        </button>
        <button 
          onClick={runCombatTest}
          style={{
            padding: '8px 16px',
            margin: '4px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ⚔️ 전투 테스트
        </button>
      </div>
    </>
  );
};

export default App; 