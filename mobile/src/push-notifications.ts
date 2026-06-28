import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerPushToken, unregisterPushToken } from './api';
import { getFirebasePushToken, listenForFirebasePushTokenChanges } from './firebase-push-token';
import type { DeviceType } from './types';

let stopTokenRefreshListener: (() => void) | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function nativeDeviceType(): DeviceType | null {
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'ios') return 'ios';
  return null;
}

function nativeDeviceName() {
  return [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || Device.deviceName || undefined;
}

export async function registerNativePushToken(authToken: string) {
  const deviceType = nativeDeviceType();
  if (!deviceType || !Device.isDevice) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }

  const currentPermissions = await Notifications.getPermissionsAsync();
  const finalPermissions = currentPermissions.granted
    ? currentPermissions
    : await Notifications.requestPermissionsAsync();
  if (!finalPermissions.granted) return;

  const pushToken = await getFirebasePushToken();
  await registerPushToken(authToken, pushToken, deviceType, nativeDeviceName());

  stopTokenRefreshListener?.();
  stopTokenRefreshListener = listenForFirebasePushTokenChanges((refreshedToken) => {
    registerPushToken(authToken, refreshedToken, deviceType, nativeDeviceName()).catch(() => {});
  });
}

export async function unregisterNativePushToken(authToken: string) {
  stopTokenRefreshListener?.();
  stopTokenRefreshListener = null;

  const deviceType = nativeDeviceType();
  if (!deviceType || !Device.isDevice) return;

  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) return;

  const pushToken = await getFirebasePushToken();
  await unregisterPushToken(authToken, pushToken);
}
