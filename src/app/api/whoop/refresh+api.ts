import { requestWhoopToken } from '@/lib/whoop/server';

// Trades a refresh token for a new access + refresh token pair.
export async function POST(request: Request) {
    const { refreshToken } = await request.json();
    if (typeof refreshToken !== 'string') {
        return Response.json({ error: 'refreshToken is required' }, { status: 400 });
    }
    return requestWhoopToken({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: 'offline',
    });
}
