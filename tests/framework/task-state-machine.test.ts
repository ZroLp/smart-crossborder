import { TaskStateMachine } from '@/lib/framework/task-state-machine';
import { TaskStatus } from '@/lib/framework/types';

describe('TaskStateMachine', () => {
  let sm: TaskStateMachine;

  beforeEach(() => {
    sm = new TaskStateMachine();
  });

  describe('canTransition', () => {
    test('allows pending -> running', () => {
      expect(sm.canTransition('pending', 'running')).toBe(true);
    });

    test('allows running -> completed', () => {
      expect(sm.canTransition('running', 'completed')).toBe(true);
    });

    test('allows running -> failed', () => {
      expect(sm.canTransition('running', 'failed')).toBe(true);
    });

    test('allows failed -> pending', () => {
      expect(sm.canTransition('failed', 'pending')).toBe(true);
    });

    test('does not allow completed -> anything', () => {
      expect(sm.canTransition('completed', 'pending')).toBe(false);
      expect(sm.canTransition('completed', 'running')).toBe(false);
      expect(sm.canTransition('completed', 'completed')).toBe(false);
      expect(sm.canTransition('completed', 'failed')).toBe(false);
    });

    test('does not allow pending -> completed directly', () => {
      expect(sm.canTransition('pending', 'completed')).toBe(false);
    });

    test('does not allow pending -> failed directly', () => {
      expect(sm.canTransition('pending', 'failed')).toBe(false);
    });

    test('does not allow running -> pending', () => {
      expect(sm.canTransition('running', 'pending')).toBe(false);
    });

    test('does not allow failed -> running', () => {
      expect(sm.canTransition('failed', 'running')).toBe(false);
    });
  });

  describe('transition', () => {
    test('returns new status on valid transition', () => {
      expect(sm.transition('pending', 'running')).toBe('running');
    });

    test('throws on invalid transition', () => {
      expect(() => sm.transition('pending', 'completed')).toThrow('Invalid transition');
    });
  });

  describe('isTerminal', () => {
    test('completed is terminal', () => {
      expect(sm.isTerminal('completed')).toBe(true);
    });

    test('pending is not terminal', () => {
      expect(sm.isTerminal('pending')).toBe(false);
    });

    test('running is not terminal', () => {
      expect(sm.isTerminal('running')).toBe(false);
    });

    test('failed is not terminal', () => {
      expect(sm.isTerminal('failed')).toBe(false);
    });
  });
});
