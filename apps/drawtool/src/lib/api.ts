const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export function createApi(getToken: () => Promise<string | null>) {
  async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await getToken()
    const res = await fetch(`${API_URL}${path}`, {
      method,
      cache: 'no-store',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new ApiError(res.status, res.statusText)
    return res.json()
  }
  return {
    get:    <T>(path: string)                  => req<T>('GET',    path),
    post:   <T>(path: string, body?: unknown)  => req<T>('POST',   path, body),
    put:    <T>(path: string, body: unknown)   => req<T>('PUT',    path, body),
    patch:  <T>(path: string, body: unknown)   => req<T>('PATCH',  path, body),
    delete: <T>(path: string)                  => req<T>('DELETE', path),
  }
}

export type Api = ReturnType<typeof createApi>
