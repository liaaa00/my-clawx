/**
 * OAuth Flows for MiniMax and Qwen Portal
 *
 * These functions are inlined from openclaw/extensions because the npm-published
 * version of openclaw does not include the extensions directory.
 *
 * Uses openclaw/plugin-sdk for PKCE utilities.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import {
    generatePkceVerifierChallenge,
    toFormUrlEncoded,
} from 'openclaw/plugin-sdk';

// ─────────────────────────────────────────────────────────────
// MiniMax OAuth
// ─────────────────────────────────────────────────────────────

export type MiniMaxRegion = 'cn' | 'global';

const MINIMAX_OAUTH_CONFIG = {
    cn: {
        baseUrl: 'https://api.minimaxi.com',
        clientId: '78257093-7e40-4613-99e0-527b14b39113',
    },
    global: {
        baseUrl: 'https://api.minimax.io',
        clientId: '78257093-7e40-4613-99e0-527b14b39113',
    },
} as const;

const MINIMAX_OAUTH_SCOPE = 'group_id profile model.completion';
const MINIMAX_OAUTH_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:user_code';

function getMiniMaxOAuthEndpoints(region: MiniMaxRegion) {
    const config = MINIMAX_OAUTH_CONFIG[region];
    return {
        codeEndpoint: `${config.baseUrl}/oauth/code`,
        tokenEndpoint: `${config.baseUrl}/oauth/token`,
        clientId: config.clientId,
        baseUrl: config.baseUrl,
    };
}

export type MiniMaxOAuthAuthorization = {
    user_code: string;
    verification_uri: string;
    expired_in: number;
    interval?: number;
    state: string;
};

export type MiniMaxOAuthToken = {
    access: string;
    refresh: string;
    expires: number;
    resourceUrl?: string;
    notification_message?: string;
};

type MiniMaxTokenPending = { status: 'pending'; message?: string };

type MiniMaxTokenResult =
    | { status: 'success'; token: MiniMaxOAuthToken }
    | MiniMaxTokenPending
    | { status: 'error'; message: string };

function generateMiniMaxPkce(): { verifier: string; challenge: string; state: string } {
    const { verifier, challenge } = generatePkceVerifierChallenge();
    const state = randomBytes(16).toString('base64url');
    return { verifier, challenge, state };
}

async function requestMiniMaxOAuthCode(params: {
    challenge: string;
    state: string;
    region: MiniMaxRegion;
}): Promise<MiniMaxOAuthAuthorization> {
    const endpoints = getMiniMaxOAuthEndpoints(params.region);
    const response = await fetch(endpoints.codeEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'x-request-id': randomUUID(),
        },
        body: toFormUrlEncoded({
            response_type: 'code',
            client_id: endpoints.clientId,
            scope: MINIMAX_OAUTH_SCOPE,
            code_challenge: params.challenge,
            code_challenge_method: 'S256',
            state: params.state,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`MiniMax OAuth authorization failed: ${text || response.statusText}`);
    }

    const payload = (await response.json()) as MiniMaxOAuthAuthorization & { error?: string };
    if (!payload.user_code || !payload.verification_uri) {
        throw new Error(
            payload.error ??
                'MiniMax OAuth authorization returned an incomplete payload (missing user_code or verification_uri).',
        );
    }
    if (payload.state !== params.state) {
        throw new Error('MiniMax OAuth state mismatch: possible CSRF attack or session corruption.');
    }
    return payload;
}

async function pollMiniMaxOAuthToken(params: {
    userCode: string;
    verifier: string;
    region: MiniMaxRegion;
}): Promise<MiniMaxTokenResult> {
    const endpoints = getMiniMaxOAuthEndpoints(params.region);
    const response = await fetch(endpoints.tokenEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body: toFormUrlEncoded({
            grant_type: MINIMAX_OAUTH_GRANT_TYPE,
            client_id: endpoints.clientId,
            user_code: params.userCode,
            code_verifier: params.verifier,
        }),
    });

    const text = await response.text();
    let payload:
        | {
              status?: string;
              base_resp?: { status_code?: number; status_msg?: string };
          }
        | undefined;
    if (text) {
        try {
            payload = JSON.parse(text) as typeof payload;
        } catch {
            payload = undefined;
        }
    }

    if (!response.ok) {
        return {
            status: 'error',
            message:
                (payload?.base_resp?.status_msg ?? text) || 'MiniMax OAuth failed to parse response.',
        };
    }

    if (!payload) {
        return { status: 'error', message: 'MiniMax OAuth failed to parse response.' };
    }

    const tokenPayload = payload as {
        status: string;
        access_token?: string | null;
        refresh_token?: string | null;
        expired_in?: number | null;
        token_type?: string;
        resource_url?: string;
        notification_message?: string;
    };

    if (tokenPayload.status === 'error') {
        return { status: 'error', message: 'An error occurred. Please try again later' };
    }

    if (tokenPayload.status != 'success') {
        return { status: 'pending', message: 'current user code is not authorized' };
    }

    if (!tokenPayload.access_token || !tokenPayload.refresh_token || !tokenPayload.expired_in) {
        return { status: 'error', message: 'MiniMax OAuth returned incomplete token payload.' };
    }

    return {
        status: 'success',
        token: {
            access: tokenPayload.access_token,
            refresh: tokenPayload.refresh_token,
            expires: tokenPayload.expired_in,
            resourceUrl: tokenPayload.resource_url,
            notification_message: tokenPayload.notification_message,
        },
    };
}

export async function loginMiniMaxPortalOAuth(params: {
    openUrl: (url: string) => Promise<void>;
    note: (message: string, title?: string) => Promise<void>;
    progress: { update: (message: string) => void; stop: (message?: string) => void };
    region?: MiniMaxRegion;
}): Promise<MiniMaxOAuthToken> {
    const region = params.region ?? 'global';
    const { verifier, challenge, state } = generateMiniMaxPkce();
    const oauth = await requestMiniMaxOAuthCode({ challenge, state, region });
    const verificationUrl = oauth.verification_uri;

    const noteLines = [
        `Open ${verificationUrl} to approve access.`,
        `If prompted, enter the code ${oauth.user_code}.`,
        `Interval: ${oauth.interval ?? 'default (2000ms)'}, Expires at: ${oauth.expired_in} unix timestamp`,
    ];
    await params.note(noteLines.join('\n'), 'MiniMax OAuth');

    try {
        await params.openUrl(verificationUrl);
    } catch {
        // Fall back to manual copy/paste if browser open fails.
    }

    let pollIntervalMs = oauth.interval ? oauth.interval : 2000;
    const expireTimeMs = oauth.expired_in;

    while (Date.now() < expireTimeMs) {
        params.progress.update('Waiting for MiniMax OAuth approval…');
        const result = await pollMiniMaxOAuthToken({
            userCode: oauth.user_code,
            verifier,
            region,
        });

        if (result.status === 'success') {
            return result.token;
        }

        if (result.status === 'error') {
            throw new Error(`MiniMax OAuth failed: ${result.message}`);
        }

        if (result.status === 'pending') {
            pollIntervalMs = Math.min(pollIntervalMs * 1.5, 10000);
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('MiniMax OAuth timed out waiting for authorization.');
}

// ─────────────────────────────────────────────────────────────
// Qwen OAuth
// ─────────────────────────────────────────────────────────────

const QWEN_OAUTH_BASE_URL = 'https://chat.qwen.ai';
const QWEN_OAUTH_DEVICE_CODE_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/device/code`;
const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`;
const QWEN_OAUTH_CLIENT_ID = 'f0304373b74a44d2b584a3fb70ca9e56';
const QWEN_OAUTH_SCOPE = 'openid profile email model.completion';
const QWEN_OAUTH_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

export type QwenDeviceAuthorization = {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete?: string;
    expires_in: number;
    interval?: number;
};

export type QwenOAuthToken = {
    access: string;
    refresh: string;
    expires: number;
    resourceUrl?: string;
};

type QwenTokenPending = { status: 'pending'; slowDown?: boolean };

type QwenDeviceTokenResult =
    | { status: 'success'; token: QwenOAuthToken }
    | QwenTokenPending
    | { status: 'error'; message: string };

async function requestQwenDeviceCode(params: { challenge: string }): Promise<QwenDeviceAuthorization> {
    const response = await fetch(QWEN_OAUTH_DEVICE_CODE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'x-request-id': randomUUID(),
        },
        body: toFormUrlEncoded({
            client_id: QWEN_OAUTH_CLIENT_ID,
            scope: QWEN_OAUTH_SCOPE,
            code_challenge: params.challenge,
            code_challenge_method: 'S256',
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Qwen device authorization failed: ${text || response.statusText}`);
    }

    const payload = (await response.json()) as QwenDeviceAuthorization & { error?: string };
    if (!payload.device_code || !payload.user_code || !payload.verification_uri) {
        throw new Error(
            payload.error ??
                'Qwen device authorization returned an incomplete payload (missing user_code or verification_uri).',
        );
    }
    return payload;
}

async function pollQwenDeviceToken(params: {
    deviceCode: string;
    verifier: string;
}): Promise<QwenDeviceTokenResult> {
    const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body: toFormUrlEncoded({
            grant_type: QWEN_OAUTH_GRANT_TYPE,
            client_id: QWEN_OAUTH_CLIENT_ID,
            device_code: params.deviceCode,
            code_verifier: params.verifier,
        }),
    });

    if (!response.ok) {
        let payload: { error?: string; error_description?: string } | undefined;
        try {
            payload = (await response.json()) as { error?: string; error_description?: string };
        } catch {
            const text = await response.text();
            return { status: 'error', message: text || response.statusText };
        }

        if (payload?.error === 'authorization_pending') {
            return { status: 'pending' };
        }

        if (payload?.error === 'slow_down') {
            return { status: 'pending', slowDown: true };
        }

        return {
            status: 'error',
            message: payload?.error_description || payload?.error || response.statusText,
        };
    }

    const tokenPayload = (await response.json()) as {
        access_token?: string | null;
        refresh_token?: string | null;
        expires_in?: number | null;
        token_type?: string;
        resource_url?: string;
    };

    if (!tokenPayload.access_token || !tokenPayload.refresh_token || !tokenPayload.expires_in) {
        return { status: 'error', message: 'Qwen OAuth returned incomplete token payload.' };
    }

    return {
        status: 'success',
        token: {
            access: tokenPayload.access_token,
            refresh: tokenPayload.refresh_token,
            expires: Date.now() + tokenPayload.expires_in * 1000,
            resourceUrl: tokenPayload.resource_url,
        },
    };
}

export async function loginQwenPortalOAuth(params: {
    openUrl: (url: string) => Promise<void>;
    note: (message: string, title?: string) => Promise<void>;
    progress: { update: (message: string) => void; stop: (message?: string) => void };
}): Promise<QwenOAuthToken> {
    const { verifier, challenge } = generatePkceVerifierChallenge();
    const device = await requestQwenDeviceCode({ challenge });
    const verificationUrl = device.verification_uri_complete || device.verification_uri;

    await params.note(
        [
            `Open ${verificationUrl} to approve access.`,
            `If prompted, enter the code ${device.user_code}.`,
        ].join('\n'),
        'Qwen OAuth',
    );

    try {
        await params.openUrl(verificationUrl);
    } catch {
        // Fall back to manual copy/paste if browser open fails.
    }

    const start = Date.now();
    let pollIntervalMs = device.interval ? device.interval * 1000 : 2000;
    const timeoutMs = device.expires_in * 1000;

    while (Date.now() - start < timeoutMs) {
        params.progress.update('Waiting for Qwen OAuth approval…');
        const result = await pollQwenDeviceToken({
            deviceCode: device.device_code,
            verifier,
        });

        if (result.status === 'success') {
            return result.token;
        }

        if (result.status === 'error') {
            throw new Error(`Qwen OAuth failed: ${result.message}`);
        }

        if (result.status === 'pending' && result.slowDown) {
            pollIntervalMs = Math.min(pollIntervalMs * 1.5, 10000);
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('Qwen OAuth timed out waiting for authorization.');
}