/** Base path for the REST API (SAD §4.2). */
export const API_BASE = '/api/v1';

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Low-level fetch wrapper. Sends/receives JSON, includes credentials so the
 * refresh cookie flows, and normalizes error responses to `ApiError`.
 */
export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; accessToken?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.accessToken) headers['Authorization'] = `Bearer ${options.accessToken}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err: ApiError = {
      status: res.status,
      code: data?.error?.code ?? 'ERROR',
      message: data?.error?.message ?? 'Request failed.',
      details: data?.error?.details,
    };
    throw err;
  }
  return data as T;
}
