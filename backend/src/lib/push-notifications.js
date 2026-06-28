import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { env } from '../config/env.js';

const REVOKED_TOKEN_ERROR_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered'
]);

function parseServiceAccount() {
  const rawJson = env.FCM_SERVICE_ACCOUNT_JSON
    || (env.FCM_SERVICE_ACCOUNT_BASE64
      ? Buffer.from(env.FCM_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
      : '');
  if (!rawJson) return null;

  const serviceAccount = JSON.parse(rawJson);
  if (typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  return serviceAccount;
}

function getFirebaseMessaging() {
  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) return null;

  const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount) });
  return getMessaging(app);
}

export function pushNotificationsConfigured() {
  return Boolean(env.FCM_SERVICE_ACCOUNT_JSON || env.FCM_SERVICE_ACCOUNT_BASE64);
}

export async function sendPushNotifications(tokens, notification, data = {}) {
  const validTokens = [...new Set(tokens.filter(Boolean))];
  if (!validTokens.length) return { sent: 0, failed: 0, skipped: false, invalidTokens: [] };

  const messaging = getFirebaseMessaging();
  if (!messaging) return { sent: 0, failed: 0, skipped: true, invalidTokens: [] };

  const result = await messaging.sendEachForMulticast({
    tokens: validTokens,
    notification,
    data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value ?? '')])),
    android: {
      priority: 'high',
      notification: {
        channelId: 'messages',
        sound: 'default'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default'
        }
      }
    }
  });

  const invalidTokens = result.responses.flatMap((response, index) => {
    const errorCode = response.error?.code;
    return errorCode && REVOKED_TOKEN_ERROR_CODES.has(errorCode) ? [validTokens[index]] : [];
  });

  return { sent: result.successCount, failed: result.failureCount, skipped: false, invalidTokens };
}
