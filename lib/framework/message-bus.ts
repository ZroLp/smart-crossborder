import { MessageHandler } from './types';

export class MessageBus {
  private handlers: Map<string, Set<MessageHandler>> = new Map();

  subscribe(event: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => {
      this.handlers.get(event)?.delete(handler);
      if (this.handlers.get(event)?.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  publish(event: string, data: unknown): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(event, data));
    }
  }

  once(event: string, handler: MessageHandler): () => void {
    const wrapper: MessageHandler = (e, d) => {
      handler(e, d);
      unsubscribe();
    };
    const unsubscribe = this.subscribe(event, wrapper);
    return unsubscribe;
  }

  clear(): void {
    this.handlers.clear();
  }

  listenerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}
