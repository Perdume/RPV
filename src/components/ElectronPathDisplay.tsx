import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { theme } from '../styles/theme';

const PathInfoContainer = styled.div`
  margin-top: ${theme.spacing.md};
  padding: ${theme.spacing.md};
  background: ${theme.colors.background.secondary};
  border-radius: ${theme.borderRadius.md};
  font-family: ${theme.fonts.mono};
  font-size: 0.85em;
  color: ${theme.colors.text.secondary};
  border: 1px solid ${theme.colors.border};
`;

const PathRow = styled.div`
  display: flex;
  margin-bottom: ${theme.spacing.xs};
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const PathLabel = styled.span`
  min-width: 120px;
  color: ${theme.colors.accent.action};
  font-weight: 600;
`;

const PathValue = styled.span`
  flex: 1;
  word-break: break-all;
  color: ${theme.colors.text.primary};
`;

const StatusIcon = styled.span<{ status: 'good' | 'warning' | 'error' }>`
  margin-right: 8px;
  color: ${props => {
    switch (props.status) {
      case 'good': return theme.colors.status.alive;
      case 'warning': return theme.colors.status.wounded;
      case 'error': return theme.colors.status.dead;
      default: return theme.colors.text.secondary;
    }
  }};
`;

const ToggleButton = styled.button`
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  background: ${theme.colors.accent.action};
  color: white;
  border: none;
  border-radius: ${theme.borderRadius.sm};
  font-family: ${theme.fonts.mono};
  font-size: 0.8em;
  cursor: pointer;
  margin-bottom: ${theme.spacing.sm};
  transition: ${theme.transitions.default};

  &:hover {
    background: ${theme.colors.accent.survivor};
  }
`;

const RefreshButton = styled.button`
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  background: ${theme.colors.accent.warning};
  color: white;
  border: none;
  border-radius: ${theme.borderRadius.sm};
  font-family: ${theme.fonts.mono};
  font-size: 0.8em;
  cursor: pointer;
  margin-left: ${theme.spacing.sm};
  transition: ${theme.transitions.default};

  &:hover {
    background: ${theme.colors.accent.danger};
  }
`;

interface PathInfo {
  cwd?: string;
  appPath?: string;
  userData?: string;
  execPath?: string;
  __dirname?: string;
  isDev?: boolean;
  url: string;
  isElectron: boolean;
}

interface FileCheck {
  exists: boolean;
  absolutePath?: string;
  isFile?: boolean;
  isDirectory?: boolean;
  size?: number;
}

export const ElectronPathDisplay: React.FC = () => {
  const [pathInfo, setPathInfo] = useState<PathInfo>({
    url: window.location.href,
    isElectron: !!(window as any).electron
  });
  const [fileChecks, setFileChecks] = useState<{ [key: string]: FileCheck }>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadPathInfo = async () => {
    setIsLoading(true);
    try {
      // 기본 정보
      const basicInfo: PathInfo = {
        url: window.location.href,
        isElectron: !!(window as any).electron
      };

      // Electron 환경에서 추가 정보 가져오기
      if ((window as any).electron?.ipcRenderer) {
        try {
          const electronPaths = await (window as any).electron.ipcRenderer.invoke('debug:getAllPaths');
          Object.assign(basicInfo, electronPaths);
        } catch (error) {
          console.error('Electron 경로 정보 가져오기 실패:', error);
        }

        // 중요 파일들 확인
        const filesToCheck = [
          'Data/data.json',
          'src/data',
          'src/data/abilities',
          'package.json',
          'dist/index.html'
        ];

        const fileResults: { [key: string]: FileCheck } = {};
        
        for (const file of filesToCheck) {
          try {
            const result = await (window as any).electron.ipcRenderer.invoke('debug:checkFile', file);
            fileResults[file] = result;
          } catch (error) {
            fileResults[file] = { exists: false };
          }
        }
        
        setFileChecks(fileResults);
      }

      setPathInfo(basicInfo);
    } catch (error) {
      console.error('경로 정보 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPathInfo();
  }, []);

  const getEnvironmentStatus = (): 'good' | 'warning' | 'error' => {
    if (!pathInfo.isElectron) return 'warning';
    if (fileChecks['Data/data.json']?.exists) return 'good';
    return 'error';
  };

  const formatPath = (path: string | undefined): string => {
    if (!path) return '정보 없음';
    if (path.length > 60) {
      return '...' + path.slice(-57);
    }
    return path;
  };

  return (
    <PathInfoContainer>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: theme.spacing.sm }}>
        <ToggleButton onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? '📁 경로 정보 접기' : '📁 실행 위치 보기'}
        </ToggleButton>
        
        <RefreshButton onClick={loadPathInfo} disabled={isLoading}>
          {isLoading ? '🔄 로딩...' : '🔄 새로고침'}
        </RefreshButton>

        <StatusIcon status={getEnvironmentStatus()}>
          {pathInfo.isElectron ? '⚡ Electron' : '🌐 웹브라우저'}
        </StatusIcon>
      </div>

      <PathRow>
        <PathLabel>현재 URL:</PathLabel>
        <PathValue>{pathInfo.url}</PathValue>
      </PathRow>

      {isExpanded && (
        <>
          {pathInfo.isElectron ? (
            <>
              <PathRow>
                <PathLabel>환경:</PathLabel>
                <PathValue>
                  <StatusIcon status="good">⚡</StatusIcon>
                  Electron {pathInfo.isDev ? '(개발 모드)' : '(프로덕션 모드)'}
                </PathValue>
              </PathRow>

              <PathRow>
                <PathLabel>작업 디렉토리:</PathLabel>
                <PathValue>{formatPath(pathInfo.cwd)}</PathValue>
              </PathRow>

              <PathRow>
                <PathLabel>앱 경로:</PathLabel>
                <PathValue>{formatPath(pathInfo.appPath)}</PathValue>
              </PathRow>

              <PathRow>
                <PathLabel>사용자 데이터:</PathLabel>
                <PathValue>{formatPath(pathInfo.userData)}</PathValue>
              </PathRow>

              <PathRow>
                <PathLabel>메인 프로세스:</PathLabel>
                <PathValue>{formatPath(pathInfo.__dirname)}</PathValue>
              </PathRow>

              {Object.keys(fileChecks).length > 0 && (
                <>
                  <hr style={{ margin: `${theme.spacing.sm} 0`, border: `1px solid ${theme.colors.border}` }} />
                  <div style={{ marginBottom: theme.spacing.xs, fontWeight: 600, color: theme.colors.accent.action }}>
                    파일 시스템 상태:
                  </div>
                  
                  {Object.entries(fileChecks).map(([file, check]) => (
                    <PathRow key={file}>
                      <PathLabel>
                        <StatusIcon status={check.exists ? 'good' : 'error'}>
                          {check.exists ? '✅' : '❌'}
                        </StatusIcon>
                        {file}:
                      </PathLabel>
                      <PathValue>
                        {check.exists ? (
                          <>
                            {check.isDirectory ? '📁 디렉토리' : '📄 파일'}
                            {check.size && ` (${(check.size / 1024).toFixed(1)}KB)`}
                          </>
                        ) : (
                          '존재하지 않음'
                        )}
                      </PathValue>
                    </PathRow>
                  ))}
                </>
              )}
            </>
          ) : (
            <>
              <PathRow>
                <PathLabel>환경:</PathLabel>
                <PathValue>
                  <StatusIcon status="warning">🌐</StatusIcon>
                  웹 브라우저 (파일 시스템 제한)
                </PathValue>
              </PathRow>

              <PathRow>
                <PathLabel>User Agent:</PathLabel>
                <PathValue>{navigator.userAgent}</PathValue>
              </PathRow>

              <PathRow>
                <PathLabel>저장소:</PathLabel>
                <PathValue>localStorage (브라우저 로컬 저장소)</PathValue>
              </PathRow>
            </>
          )}
        </>
      )}
    </PathInfoContainer>
  );
};