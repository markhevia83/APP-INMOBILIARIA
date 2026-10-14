// Run with Deno, without --allow-net. Every request remains in this process.
type Handler = (request: Request) => Response | Promise<Response>;
const originalServe = Deno.serve;
const originalFetch = globalThis.fetch;
const functions = ['chat', 'context', 'daily', 'motivation', 'discover', 'onboarding'];

Deno.test('all six entrypoints reject anonymous and invalid sessions before data access', async () => {
  const previousUrl = Deno.env.get('SUPABASE_URL');
  const previousKey = Deno.env.get('SUPABASE_ANON_KEY');
  Deno.env.set('SUPABASE_URL', 'https://selfia-synthetic.invalid');
  Deno.env.set('SUPABASE_ANON_KEY', 'synthetic-public-key');
  let handler: Handler | undefined;
  let authRequests = 0;
  Object.defineProperty(Deno, 'serve', { configurable: true, value: (fn: Handler) => { handler = fn; } });
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== 'https://selfia-synthetic.invalid' || url.pathname !== '/auth/v1/user') {
      throw new Error('Unexpected data/model/network access: ' + url.pathname);
    }
    authRequests++;
    return Promise.resolve(new Response(JSON.stringify({ message: 'Invalid JWT', code: 'bad_jwt' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    }));
  }) as typeof fetch;
  const expectStatus = async (request: Request, expected: number, name: string) => {
    if (!handler) throw new Error('No handler registered for ' + name);
    const response = await handler(request);
    if (response.status !== expected) throw new Error(`${name}: expected ${expected}, got ${response.status}`);
    if (response.headers.get('access-control-allow-origin') !== '*') throw new Error(name + ': missing CORS');
  };
  try {
    for (const name of functions) {
      handler = undefined;
      await import(`../functions/selfia-${name}/index.ts`);
      const url = 'https://selfia-synthetic.invalid/functions/v1/selfia-' + name;
      await expectStatus(new Request(url, { method: 'OPTIONS' }), 200, name);
      await expectStatus(new Request(url), 405, name);
      const before = authRequests;
      await expectStatus(new Request(url, { method: 'POST', body: '{}' }), 401, name);
      if (authRequests !== before) throw new Error(name + ': unauthenticated request touched backend');
      for (const token of ['forged-user-token', 'synthetic-public-key']) {
        await expectStatus(new Request(url, {
          method: 'POST', headers: { authorization: 'Bearer ' + token }, body: '{}',
        }), 401, name);
      }
      if (authRequests !== before + 2) throw new Error(name + ': token validation was skipped');
    }
  } finally {
    Object.defineProperty(Deno, 'serve', { configurable: true, value: originalServe });
    globalThis.fetch = originalFetch;
    const variables: [string, string | undefined][] = [['SUPABASE_URL', previousUrl], ['SUPABASE_ANON_KEY', previousKey]];
    for (const [key, value] of variables) {
      if (value === undefined) Deno.env.delete(key); else Deno.env.set(key, value);
    }
  }
});
