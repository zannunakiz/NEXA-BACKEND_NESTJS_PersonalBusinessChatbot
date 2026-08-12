export const DEFAULT_BASE_URL = 'http://localhost:3000';

export interface User {
  email: string;
  username: string;
  password: string;
}

export function makeUser(prefix: string): User {
  const now = Date.now();
  return {
    email: `${prefix}_${now}@nuxa.ai`,
    username: `${prefix}_${now}`,
    password: 'SecurePass123!',
  };
}

export interface ApiResult {
  json: any;
  status: number;
  ok: boolean;
}

export class E2eClient {
  baseUrl = DEFAULT_BASE_URL;

  tokens: Record<string, string> = {};

  async api(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    token?: string,
  ): Promise<ApiResult> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const resp = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json: any = null;
    try {
      json = await resp.json();
    } catch {
      json = null;
    }
    return { json, status: resp.status, ok: resp.ok };
  }

  data(result: ApiResult): any {
    return result.json && result.json.data !== undefined
      ? result.json.data
      : result.json;
  }

  async register(user: User): Promise<{ userData: any; token: string }> {
    const result = await this.api('POST', '/auth/register', {
      email: user.email,
      username: user.username,
      password: user.password,
    });
    if (!result.ok) {
      throw new Error(`Register failed: ${result.status}`);
    }
    const data = this.data(result);
    return { userData: data.user, token: data.accessToken };
  }

  async me(token: string): Promise<any> {
    const result = await this.api('GET', '/auth/me', undefined, token);
    return this.data(result);
  }

  async multipart(
    method: 'POST' | 'PUT',
    path: string,
    fields: Record<string, string>,
    token?: string,
  ): Promise<ApiResult> {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const resp = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: form,
    });
    let json: any = null;
    try {
      json = await resp.json();
    } catch {
      json = null;
    }
    return { json, status: resp.status, ok: resp.ok };
  }
}
