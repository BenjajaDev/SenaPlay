import { fakeSupabase } from '../../../jest/fakes';
import { TimeoutError, withTimeout } from '../net/withTimeout';

describe('withTimeout', () => {
  afterEach(() => jest.useRealTimers());

  test('devuelve la respuesta si llega a tiempo', async () => {
    const supabase = fakeSupabase(() => ({ data: [1], error: null }));
    await expect(withTimeout(supabase.from('levels').select('*'), 1000)).resolves.toEqual({ data: [1], error: null });
    expect(supabase.calls[0].aborted).toBe(false);
  });

  test('rechaza con TimeoutError y cancela la petición si la red no responde', async () => {
    jest.useFakeTimers();
    const supabase = fakeSupabase(() => 'hang');
    const pending = withTimeout(supabase.from('levels').select('*'), 500);
    jest.advanceTimersByTime(500);
    await expect(pending).rejects.toBeInstanceOf(TimeoutError);
    expect(supabase.calls[0].aborted).toBe(true);
  });

  test('acepta promesas comunes (sin abortSignal)', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100)).resolves.toBe('ok');
  });
});
