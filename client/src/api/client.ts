/**
 * Small typed fetch client for the ausspend JSON API.
 *
 * Every failure is normalised into an `ApiError` with an HTTP status (or
 * `null` for a transport/network failure) so pages can render a visible,
 * honest error state instead of an empty page.
 */

export type ApiErrorKind = 'network' | 'bad-request' | 'not-found' | 'http' | 'invalid-response';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly kind: ApiErrorKind,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  ok?: boolean;
  error?: string;
}

function isErrorBody(value: unknown): value is ErrorBody {
  return typeof value === 'object' && value !== null && 'error' in value;
}

function kindForStatus(status: number): ApiErrorKind {
  if (status === 400) return 'bad-request';
  if (status === 404) return 'not-found';
  return 'http';
}

export async function apiGet<T>(path: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new ApiError(
      'Could not reach the ausspend API. Check that the API server is running.',
      null,
      'network',
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      isErrorBody(body) && body.error ? body.error : `Request failed (${response.status})`;
    throw new ApiError(message, response.status, kindForStatus(response.status));
  }

  if (body === null) {
    throw new ApiError(
      'The API returned an empty or non-JSON response.',
      response.status,
      'invalid-response',
    );
  }

  return body as T;
}

/** Build a query string from defined, non-empty values. */
export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}
