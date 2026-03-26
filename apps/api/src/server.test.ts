import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('./config/env.js', () => ({
  env: {
    PORT: 0,
  },
}));

vi.mock('./types/context.js', () => ({
  createContext: () => ({ prisma: {}, userId: undefined }),
}));

const { createApp, startServer, registerSignalHandlers } = await import('./server.js');

describe('HTTP server', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes a health endpoint', async () => {
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('starts listening and registers shutdown handlers', async () => {
    const onceSpy = vi.spyOn(process, 'once').mockImplementation(() => process);

    const server = startServer();
    await new Promise((resolve) => server.once('listening', resolve));
    server.close();

    expect(onceSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(onceSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });

  it('registers handlers that close the server', () => {
    const close = vi.fn();
    const server = {
      close,
    } as unknown as Parameters<typeof registerSignalHandlers>[0];
    const handlers: Array<() => void> = [];
    vi.spyOn(process, 'once').mockImplementation((event, handler: () => void) => {
      void event;
      handlers.push(handler);
      return process;
    });

    registerSignalHandlers(server);

    expect(close).not.toHaveBeenCalled();
    handlers.forEach((handler) => handler());
    expect(close).toHaveBeenCalledTimes(2);
  });
});
