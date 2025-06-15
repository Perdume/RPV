import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { GameEvent, GameEventType } from '../events';
import { Player } from '../types';
import { ChatMessage } from './ChatMessage';

interface ChatContainerProps {
  events: GameEvent[];
  players: Map<number, Player>;
}

const Container = styled.div<{ isDarkMode: boolean }>`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${props => props.isDarkMode ? '#36393f' : '#f8f9fa'};
  border-radius: 8px;
  overflow: hidden;
`;

const Header = styled.div<{ isDarkMode: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: ${props => props.isDarkMode ? '#2f3136' : '#ffffff'};
  border-bottom: 1px solid ${props => props.isDarkMode ? '#202225' : '#e3e5e8'};
`;

const Title = styled.h2<{ isDarkMode: boolean }>`
  margin: 0;
  color: ${props => props.isDarkMode ? '#ffffff' : '#2e3338'};
  font-size: 1.2em;
`;

const ThemeToggle = styled.button<{ isDarkMode: boolean }>`
  background: ${props => props.isDarkMode ? '#5865f2' : '#7289da'};
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.isDarkMode ? '#4752c4' : '#677bc4'};
  }
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`;

const InputContainer = styled.div<{ isDarkMode: boolean }>`
  padding: 16px;
  background: ${props => props.isDarkMode ? '#2f3136' : '#ffffff'};
  border-top: 1px solid ${props => props.isDarkMode ? '#202225' : '#e3e5e8'};
`;

const Input = styled.input<{ isDarkMode: boolean }>`
  width: 100%;
  padding: 12px;
  border-radius: 4px;
  border: 1px solid ${props => props.isDarkMode ? '#202225' : '#e3e5e8'};
  background: ${props => props.isDarkMode ? '#40444b' : '#f8f9fa'};
  color: ${props => props.isDarkMode ? '#ffffff' : '#2e3338'};
  font-size: 1em;

  &:focus {
    outline: none;
    border-color: ${props => props.isDarkMode ? '#5865f2' : '#7289da'};
  }
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

export const ChatContainer: React.FC<ChatContainerProps> = ({ events, players }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [filter, setFilter] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [events]);

  const filteredEvents = events.filter(event => {
    if (!filter) return true;
    const message = getEventMessage(event, players);
    return message.toLowerCase().includes(filter.toLowerCase());
  });

  return (
    <Container isDarkMode={isDarkMode}>
      <Header isDarkMode={isDarkMode}>
        <Title isDarkMode={isDarkMode}>게임 로그</Title>
        <ThemeToggle 
          isDarkMode={isDarkMode}
          onClick={() => setIsDarkMode(!isDarkMode)}
        >
          {isDarkMode ? '라이트 모드' : '다크 모드'}
        </ThemeToggle>
      </Header>
      <MessagesContainer>
        {filteredEvents.map((event, index) => (
          <ChatMessage
            key={`${event.type}-${event.timestamp}-${index}`}
            event={event}
            players={players}
            isDarkMode={isDarkMode}
          />
        ))}
        <div ref={messagesEndRef} />
      </MessagesContainer>
      <InputContainer isDarkMode={isDarkMode}>
        <Input
          isDarkMode={isDarkMode}
          placeholder="로그 검색..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </InputContainer>
    </Container>
  );
}; 