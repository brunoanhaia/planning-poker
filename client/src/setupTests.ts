import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));
