import { getMessaging, getToken, onTokenRefresh } from '@react-native-firebase/messaging';

export async function getFirebasePushToken() {
  return getToken(getMessaging());
}

export function listenForFirebasePushTokenChanges(listener: (token: string) => void) {
  return onTokenRefresh(getMessaging(), listener);
}
