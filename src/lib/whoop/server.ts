// Server-only. Imported exclusively by the +api routes so the secret is stripped from the app bundle.
import { WHOOP_TOKEN_URL } from './config';

export async function requestWhoopToken(params: Record<string, string>) {
    const clientId = process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID;
    const clientSecret = process.env.WHOOP_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        return Response.json(
            { error: 'Set EXPO_PUBLIC_WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET in .env.local, then restart the dev server.' },
            { status: 500 }
        );
    }

    const response = await fetch(WHOOP_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ...params, client_id: clientId, client_secret: clientSecret }).toString(),
    });
    const body = await response.text();
    return new Response(body, {
        status: response.status,
        headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' },
    });
}
