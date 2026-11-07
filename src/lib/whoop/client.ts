import * as SecureStore from 'expo-secure-store';
import { WHOOP_API_URL } from './config';

const TOKEN_KEY = 'whoop_tokens';

interface StoredTokens {
    accessToken: string,
    refreshToken: string,
    // epoch ms
    expiresAt: number,
}

interface TokenResponse {
    access_token: string,
    refresh_token: string,
    expires_in: number,
}

export class WhoopAuthError extends Error {}

export async function saveTokens(response: TokenResponse) {
    const tokens: StoredTokens = {
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        expiresAt: Date.now() + response.expires_in * 1000,
    };
    await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));
}

async function loadTokens(): Promise<StoredTokens | null> {
    const raw = await SecureStore.getItemAsync(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
}

export async function isWhoopConnected() {
    return (await loadTokens()) !== null;
}

export async function clearTokens() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function postToServer(path: string, body: object): Promise<TokenResponse> {
    const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = json.error_description ?? json.error ?? `WHOOP returned ${response.status}`;
        throw new WhoopAuthError(message);
    }
    return json as TokenResponse;
}

export async function exchangeCode(code: string, redirectUri: string) {
    const tokens = await postToServer('/api/whoop/token', { code, redirectUri });
    await saveTokens(tokens);
}

// WHOOP invalidates the old refresh token on use, so two refreshes racing would log us out.
// Every caller shares the one in-flight refresh.
let refreshing: Promise<StoredTokens> | null = null;

async function refresh(tokens: StoredTokens) {
    if (!refreshing) {
        refreshing = (async () => {
            try {
                const next = await postToServer('/api/whoop/refresh', { refreshToken: tokens.refreshToken });
                await saveTokens(next);
                return (await loadTokens())!;
            } finally {
                refreshing = null;
            }
        })();
    }
    return refreshing;
}

async function getAccessToken() {
    let tokens = await loadTokens();
    if (!tokens) {
        throw new WhoopAuthError('WHOOP is not connected');
    }
    // refresh a minute early so a request never goes out with a token about to lapse
    if (Date.now() > tokens.expiresAt - 60_000) {
        tokens = await refresh(tokens);
    }
    return tokens.accessToken;
}

export async function whoopGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const query = new URLSearchParams(params).toString();
    const url = `${WHOOP_API_URL}${path}${query ? `?${query}` : ''}`;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${await getAccessToken()}` },
    });
    if (response.status === 401) {
        throw new WhoopAuthError('WHOOP session expired. Reconnect in Settings.');
    }
    if (!response.ok) {
        throw new Error(`WHOOP ${path} failed with ${response.status}`);
    }
    return response.json() as Promise<T>;
}

interface Page<T> {
    records: T[],
    next_token?: string | null,
}

// Collection endpoints page 25 records at a time.
export async function whoopGetAll<T>(path: string, start: string, end?: string): Promise<T[]> {
    const records: T[] = [];
    let nextToken: string | null | undefined;
    do {
        const params: Record<string, string> = { limit: '25', start };
        if (end) {
            params.end = end;
        }
        if (nextToken) {
            params.nextToken = nextToken;
        }
        const page = await whoopGet<Page<T>>(path, params);
        records.push(...page.records);
        nextToken = page.next_token;
    } while (nextToken);
    return records;
}
