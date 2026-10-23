import { TaskStatus } from './types';

export class TaskStateMachine {
  private validTransitions: Map<TaskStatus, TaskStatus[]> = new Map([
    ['pending', ['running']],
    ['running', ['completed', 'failed']],
    ['completed', []],
    ['failed', ['pending']],
  ]);

  canTransition(from: TaskStatus, to: TaskStatus): boolean {
    return this.validTransitions.get(from)?.includes(to) ?? false;
  }

  transition(current: TaskStatus, to: TaskStatus): TaskStatus {
    if (!this.canTransition(current, to)) {
      throw new Error(`Invalid transition: ${current} -> ${to}`);
    }
    return to;
  }

  isTerminal(status: TaskStatus): boolean {
    return status === 'completed';
  }
}
