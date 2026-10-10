/// <reference types="@testing-library/jest-dom/vitest" />
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Polyfill window.matchMedia for jsdom (used by HeroShader reduced-motion detection)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock @paper-design/shaders-react — WebGL/Canvas not available in jsdom
vi.mock('@paper-design/shaders-react', () => ({
  MeshGradient: (props) => {
    const React = require('react');
    return React.createElement('div', {
      'data-testid': 'mesh-gradient',
      className: props.className,
      style: props.style,
    });
  },
  PulsingBorder: (props) => {
    const React = require('react');
    return React.createElement('div', {
      'data-testid': 'pulsing-border',
      className: props.className,
      style: props.style,
    });
  },
}));
