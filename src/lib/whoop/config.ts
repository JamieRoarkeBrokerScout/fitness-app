// Shared by the app and the server routes. Nothing secret lives here: the client secret
// is only read inside src/lib/whoop/server.ts, which only +api files import.

export const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
export const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
export const WHOOP_API_URL = 'https://api.prod.whoop.com/developer';

// `offline` is what gets us a refresh token.
export const WHOOP_SCOPES = [
    'offline',
    'read:profile',
    'read:recovery',
    'read:cycles',
    'read:sleep',
    'read:workout',
    'read:body_measurement',
];

export const WHOOP_CLIENT_ID = process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID ?? '';

export function isWhoopConfigured() {
    return WHOOP_CLIENT_ID.length > 0;
}
