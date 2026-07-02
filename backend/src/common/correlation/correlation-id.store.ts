import { AsyncLocalStorage } from 'async_hooks';

export const correlationIdStore = new AsyncLocalStorage<string>();

export function getCorrelationId(): string | undefined {
  return correlationIdStore.getStore();
}
