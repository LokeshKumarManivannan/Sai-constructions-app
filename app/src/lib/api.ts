import { getToken } from './storage';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (res.status === 401) onUnauthorized?.();
  if (!res.ok) {
    let message = res.statusText;
    let detail: unknown;
    try {
      detail = (await res.json()).detail;
      message = typeof detail === 'string' ? detail : JSON.stringify(detail);
    } catch {}
    throw new ApiError(res.status, message, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Multipart upload of one picked file to POST /files. Returns { id, url }. */
export async function uploadFile(
  projectId: string | null,
  file: { uri: string; name: string; type: string; webFile?: Blob },
): Promise<{ id: string; url: string }> {
  const token = await getToken();
  const form = new FormData();
  if (projectId) form.append('project_id', projectId);
  if (file.webFile) form.append('file', file.webFile, file.name);
  // React Native's FormData accepts { uri, name, type } objects for files.
  else form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  const res = await fetch(`${API_URL}/files`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))).detail ?? res.statusText);
  return res.json();
}
