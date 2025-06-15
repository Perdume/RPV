import { createGlobalStyle } from 'styled-components';
import { theme } from './theme';

export const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: ${theme.fonts.main};
    background-color: ${theme.colors.background.primary};
    color: ${theme.colors.text.primary};
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  code {
    font-family: ${theme.fonts.mono};
    font-size: ${theme.typography.code.size};
    color: ${theme.colors.text.code};
  }

  button {
    font-family: ${theme.fonts.main};
    cursor: pointer;
    border: none;
    background: none;
    color: inherit;
  }

  input, textarea {
    font-family: ${theme.fonts.mono};
    color: ${theme.colors.text.primary};
    background: ${theme.colors.background.card};
    border: 1px solid ${theme.colors.background.secondary};
    border-radius: ${theme.borderRadius.sm};
    padding: ${theme.spacing.sm};
    
    &:focus {
      outline: none;
      border-color: ${theme.colors.accent.action};
    }
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${theme.colors.background.secondary};
  }

  ::-webkit-scrollbar-thumb {
    background: ${theme.colors.background.card};
    border-radius: 4px;
    
    &:hover {
      background: ${theme.colors.accent.action};
    }
  }
`; 