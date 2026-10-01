import * as fs from 'fs';
import { WebhookSimulator } from './webhookSimulator';

describe('WebhookSimulator', () => {
  let simulator: WebhookSimulator;

  beforeEach(() => {
    simulator = new WebhookSimulator();
  });

  it('returns supported event types and a defensive copy of templates', () => {
    const events = simulator.getSupportedEvents();
    expect(events).toEqual(
      expect.arrayContaining(['push', 'pull_request', 'workflow_dispatch', 'release', 'schedule', 'issues'])
    );

    const first = simulator.getTemplate('push');
    (first.repository as Record<string, unknown>).full_name = 'changed/repo';

    const second = simulator.getTemplate('push');
    expect((second.repository as Record<string, unknown>).full_name).toBe('owner/repo');
  });

  it('returns an empty object for unsupported event types', () => {
    expect(simulator.getTemplate('unknown-event')).toEqual({});
  });

  it('writes sanitized payloads without nested sensitive keys', async () => {
    const file = await simulator.createPayloadFile({
      token: 'top-level-secret',
      repository: {
        full_name: 'owner/repo',
        authToken: 'nested-secret',
        metadata: [{ password: 'hidden', visible: true }],
      },
      apiKey: 'hidden-too',
      safe: 'keep-me',
    });

    const saved = JSON.parse(fs.readFileSync(file, 'utf-8'));

    expect(saved).toEqual({
      repository: {
        full_name: 'owner/repo',
        metadata: [{ visible: true }],
      },
      safe: 'keep-me',
    });

    simulator.cleanup(file);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('cleanup is safe when the file has already been removed', async () => {
    const file = await simulator.createPayloadFile({ hello: 'world' });
    fs.unlinkSync(file);

    expect(() => simulator.cleanup(file)).not.toThrow();
  });
});
