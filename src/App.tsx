import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { theme } from './styles/theme';
import { ActionInput } from './components/ActionInput';
import { Player, PlayerAction, PlayerStatus, GameState, TurnResult } from './types/game.types';
import { Layout } from './components/Layout';
import { GlobalStyle } from './styles/GlobalStyle';
import { TurnProcessor } from './utils/turnProcessor';
import { EventSystem } from './utils/eventSystem';
import { AbilityManager } from './abilities/AbilityManager';
import { StatusEffectManager } from './utils/StatusEffectManager';
import { useEventTesting } from './utils/manualEventTest';
import { initFileSystem } from './utils/fsInit';
import { BackupUtils } from './utils/backupUtils';
import { ElectronPathDisplay } from './components/ElectronPathDisplay';

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

const LogContainer = styled.div`
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
  const [currentTurn, setCurrentTurn] = useState(1);
  const [isDeathZone, setIsDeathZone] = useState(false);
  
  // EventSystem과 AbilityManager를 useRef로 관리하여 중복 생성 방지
  const eventSystemRef = useRef<EventSystem | null>(null);
  const abilityManagerRef = useRef<AbilityManager | null>(null);
  const turnProcessorRef = useRef<TurnProcessor | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // EventSystem 생성 시 StatusEffectManager도 함께 연결 (렌더링마다 반복하지 않음)
  if (!eventSystemRef.current) {
    eventSystemRef.current = new EventSystem();
    StatusEffectManager.initializeWithEventSystem(eventSystemRef.current);
  }

  // AbilityManager 초기화 (EventSystem과 StatusEffectManager가 준비된 후)
  if (!abilityManagerRef.current) {
    abilityManagerRef.current = new AbilityManager(eventSystemRef.current);
  }

  const abilityManager = abilityManagerRef.current;
  const { runEventTest, runRollbackTest, runRedoTest } = useEventTesting();

  // 파일 시스템 초기화
  useEffect(() => {
    initFileSystem();
  }, []);

  // 새 턴 로그가 추가되면 로그 창을 맨 아래로 스크롤
  useEffect(() => {
    const container = logContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [logs]);

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
          statusEffects: [],
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
          currentTurn: data.turn,
          isInvincible: false,
          customFlags: new Map<string, any>()
        }));

        // 능력 등록
        newPlayers.forEach(player => {
          if (player.abilityId && abilityManager) {
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
    console.log('[DEBUG] 입력된 행동:', actions);

    const gameState: GameState = {
      players,
      currentTurn,
      logs,
      isDeathZone,
      turn: currentTurn,
      survivors: players.filter(p => p.status !== PlayerStatus.DEAD),
      deathZone: isDeathZone,
      currentSession: 'game-session',
      statusEffects: new Map(),
      customGameFlags: new Map(),
      delayedEffects: [],
      gameHistory: []
    };

    // TurnProcessor가 없으면 생성, 있으면 재사용
    if (!turnProcessorRef.current) {
      // 기존 AbilityManager를 전달하여 중복 생성 방지
      turnProcessorRef.current = new TurnProcessor(gameState, eventSystemRef.current!, abilityManagerRef.current!);
    }
    
    const result = await turnProcessorRef.current.processTurn(actions);
    handleTurnComplete(result);
  };

  return (
    <>
      <GlobalStyle />
      {/* 플레이어 표와 TurnControl은 Layout이 렌더링하므로 나머지만 children으로 전달 */}
      <Layout 
        players={players}
        gameData={gameData}
        currentTurn={currentTurn}
        onTurnComplete={handleActionSubmit}
      >
        <LogContainer ref={logContainerRef}>
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <LogEntry key={index}>{log}</LogEntry>
            ))
          ) : (
            <LogEntry>턴 로그가 여기에 표시됩니다.</LogEntry>
          )}
        </LogContainer>

        <ActionInput 
          players={players} 
          onTurnComplete={handleActionSubmit}
        />
        
        {/* 실행 위치 정보 표시 */}
        <ElectronPathDisplay />
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
          onClick={runRollbackTest}
          style={{
            padding: '8px 16px',
            margin: '4px',
            backgroundColor: '#FFC107',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ⏪ 롤백 테스트
        </button>
        <button 
          onClick={runRedoTest}
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
          ⏩ 다시실행 테스트
        </button>
        <button 
          onClick={() => BackupUtils.monitorBackupStatus()}
          style={{
            padding: '8px 16px',
            margin: '4px',
            backgroundColor: '#9C27B0',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          📊 백업 상태
        </button>
        <button 
          onClick={() => BackupUtils.getDetailedBackupInfo()}
          style={{
            padding: '8px 16px',
            margin: '4px',
            backgroundColor: '#795548',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          📁 백업 상세
        </button>
      </div>
    </>
  );
};

export default App;