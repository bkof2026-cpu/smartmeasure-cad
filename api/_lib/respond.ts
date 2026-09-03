import type { VercelResponse } from '@vercel/node';

/** Every route's error body has the same shape: { error: string }. Never
 * includes the underlying exception's message when it might carry a DB
 * connection string or other secret — callers pass a safe, specific
 * message for anything that could leak internals. */
export function jsonError(res: VercelResponse, status: number, message: string) {
  res.status(status).json({ error: message });
}

export function jsonOk<T extends object>(res: VercelResponse, body: T) {
  res.status(200).json(body);
}

/** Wraps a route handler so an unexpected exception never leaks its raw
 * message (which could contain the DATABASE_URL, a stack path, etc.) to
 * the client — logs the real error server-side, returns a generic 500. */
export function withErrorHandling(handler: (req: any, res: VercelResponse) => Promise<void>) {
  return async (req: any, res: VercelResponse) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error('[api error]', err);
      jsonError(res, 500, 'Internal server error.');
    }
  };
}
