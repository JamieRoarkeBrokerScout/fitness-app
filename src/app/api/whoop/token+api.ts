import { requestWhoopToken } from '@/lib/whoop/server';

// Exchanges an OAuth authorization code for tokens.
export async function POST(request: Request) {
    const { code, redirectUri } = await request.json();
    if (typeof code !== 'string' || typeof redirectUri !== 'string') {
        return Response.json({ error: 'code and redirectUri are required' }, { status: 400 });
    }
    return requestWhoopToken({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
    });
}
