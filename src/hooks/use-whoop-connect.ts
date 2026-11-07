import { exchangeCode } from '@/lib/whoop/client';
import { WHOOP_AUTH_URL, WHOOP_CLIENT_ID, WHOOP_SCOPES, WHOOP_TOKEN_URL } from '@/lib/whoop/config';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
    authorizationEndpoint: WHOOP_AUTH_URL,
    tokenEndpoint: WHOOP_TOKEN_URL,
};

// In Expo Go this is exp://<your-ip>:8081/--/whoop; in a dev or store build, fitnessapp://whoop.
// Whichever it is must be registered as a redirect URL in the WHOOP developer dashboard.
export const whoopRedirectUri = AuthSession.makeRedirectUri({ scheme: 'fitnessapp', path: 'whoop' });

export function useWhoopConnect(onConnected: () => void) {
    // WHOOP requires the state parameter to be exactly eight characters.
    const [state] = useState(() => Crypto.randomUUID().replace(/-/g, '').slice(0, 8));
    const [exchangeError, setExchangeError] = useState<string | null>(null);
    const [exchanging, setExchanging] = useState(false);

    const [request, response, promptAsync] = AuthSession.useAuthRequest(
        {
            clientId: WHOOP_CLIENT_ID,
            scopes: WHOOP_SCOPES,
            redirectUri: whoopRedirectUri,
            state,
            // WHOOP uses a client secret (held by our server route) rather than PKCE
            usePKCE: false,
        },
        discovery
    );

    const authError = response?.type === 'error'
        ? response.error?.message ?? response.params.error_description ?? 'WHOOP sign-in failed'
        : null;

    useEffect(() => {
        if (response?.type !== 'success') {
            return;
        }
        let cancelled = false;
        async function finishConnecting(code: string) {
            setExchanging(true);
            setExchangeError(null);
            try {
                await exchangeCode(code, whoopRedirectUri);
                if (!cancelled) {
                    onConnected();
                }
            } catch (error) {
                if (!cancelled) {
                    setExchangeError(error instanceof Error ? error.message : 'Could not finish connecting WHOOP');
                }
            } finally {
                if (!cancelled) {
                    setExchanging(false);
                }
            }
        }
        void finishConnecting(response.params.code);
        return () => {
            cancelled = true;
        };
    }, [response, onConnected]);

    return {
        connect: () => promptAsync(),
        ready: request !== null,
        exchanging,
        error: authError ?? exchangeError,
    };
}
