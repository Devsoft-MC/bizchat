import * as Notifications from 'expo-notifications';

export async function getFirebasePushToken() {
  const token = await Notifications.getDevicePushTokenAsync();
  return String(token.data);
}

export function listenForFirebasePushTokenChanges(listener: (token: string) => void) {
  const subscription = Notifications.addPushTokenListener((token) => {
    listener(String(token.data));
  });

  return () => subscription.remove();
}
