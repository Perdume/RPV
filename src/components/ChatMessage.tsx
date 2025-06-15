import React from 'react';
import { GameEvent, GameEventType } from '../events';
import { Player } from '../types';
import styled from 'styled-components';

interface ChatMessageProps {
  event: GameEvent;
  players: Map<number, Player>;
  isDarkMode: boolean;
}

const MessageContainer = styled.div<{ isDarkMode: boolean }>`
  display: flex;
  padding: 12px;
  margin: 8px 0;
  border-radius: 8px;
  background: ${props => props.isDarkMode ? '#2f3136' : '#ffffff'};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.isDarkMode ? '#36393f' : '#f8f9fa'};
  }
`;

const PlayerIcon = styled.div<{ isDarkMode: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${props => props.isDarkMode ? '#5865f2' : '#7289da'};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 12px;
  flex-shrink: 0;
`;

const MessageContent = styled.div`
  flex: 1;
`;

const MessageHeader = styled.div<{ isDarkMode: boolean }>`
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  color: ${props => props.isDarkMode ? '#ffffff' : '#2e3338'};
`;

const PlayerName = styled.span`
  font-weight: 600;
  margin-right: 8px;
`;

const Timestamp = styled.span`
  font-size: 0.8em;
  color: #72767d;
`;

const MessageText = styled.div<{ isDarkMode: boolean }>`
  color: ${props => props.isDarkMode ? '#dcddde' : '#2e3338'};
  line-height: 1.4;
`;

const getEventMessage = (event: GameEvent, players: Map<number, Player>): string => {
  const getPlayerName = (id: number) => players.get(id)?.name || `Player ${id}`;

  switch (event.type) {
    case GameEventType.ATTACK:
      return `${getPlayerName(event.data.attacker)}이(가) ${getPlayerName(event.data.target)}에게 ${event.data.damage}의 데미지를 입혔습니다.`;
    case GameEventType.DEFEND:
      return `${getPlayerName(event.data.player)}이(가) 방어를 사용하여 데미지를 ${event.data.damageReduction} 감소시켰습니다.`;
    case GameEventType.EVADE:
      return `${getPlayerName(event.data.player)}이(가) 회피를 시도했습니다. (${event.data.success ? '성공' : '실패'})`;
    case GameEventType.DEATH:
      return `${getPlayerName(event.data.player)}이(가) ${getPlayerName(event.data.killer)}에 의해 탈락했습니다.`;
    case GameEventType.FOCUS_ATTACK:
      return `${getPlayerName(event.data.attacker)}이(가) ${getPlayerName(event.data.target)}에게 집중 공격을 시도했습니다.`;
    case GameEventType.HP_CHANGE:
      return `${getPlayerName(event.data.player)}의 체력이 ${event.data.oldValue}에서 ${event.data.newValue}로 변경되었습니다.`;
    case GameEventType.STATUS_CHANGE:
      return `${getPlayerName(event.data.player)}의 상태가 ${event.data.oldStatus}에서 ${event.data.newStatus}로 변경되었습니다.`;
    case GameEventType.ABILITY_USE:
      return `${getPlayerName(event.data.player)}이(가) ${event.data.abilityId} 능력을 사용했습니다.`;
    case GameEventType.ABILITY_EFFECT:
      return `${getPlayerName(event.data.player)}의 ${event.data.abilityId} 능력이 발동했습니다.`;
    default:
      return '알 수 없는 이벤트가 발생했습니다.';
  }
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ event, players, isDarkMode }) => {
  const timestamp = new Date(event.timestamp).toLocaleTimeString();
  const playerId = event.data.player || event.data.attacker;
  const player = playerId ? players.get(playerId) : null;

  return (
    <MessageContainer isDarkMode={isDarkMode}>
      {player && (
        <PlayerIcon isDarkMode={isDarkMode}>
          {player.id}
        </PlayerIcon>
      )}
      <MessageContent>
        <MessageHeader isDarkMode={isDarkMode}>
          {player && <PlayerName>{player.name}</PlayerName>}
          <Timestamp>{timestamp}</Timestamp>
        </MessageHeader>
        <MessageText isDarkMode={isDarkMode}>
          {getEventMessage(event, players)}
        </MessageText>
      </MessageContent>
    </MessageContainer>
  );
}; 