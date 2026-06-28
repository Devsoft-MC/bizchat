# BizChat Mobile

Expo React Native app for BizChat companies.
The authenticated company supplies the in-app company name and initials, so the same build supports multiple companies.

During development, the sign-in screen automatically uses the iCON Systems slug `icon`; users enter only their international-format mobile number and password. User administration stores each employee's work-location country code and timezone; the company timezone is the default.

Company Admins can list users, create accounts, activate or suspend users, edit user details and department assignments, and set a new password. Regular users see the company People Directory.

Company Admins and regular users can open People, select a colleague, and exchange stored one-to-one text messages. The first MVP refreshes messages every five seconds; Socket.IO realtime delivery is the next chat milestone.

Direct Chat supports voice messages on Android, iOS, and secure web origins. Tap the microphone to record, cancel with the X button, or tap stop to send. Voice files use the same authenticated, recipient-only attachment route as private documents.

On web, users can attach images, PDF, text, Word, and Excel files with the paperclip button or paste a clipboard image/file directly into an open chat. Attachments are limited to 10 MB and remain recipient-only. Native iOS/Android document selection is a following milestone.

The web app includes a notification bell with unread counts and a recent-conversation inbox. Users can opt into browser notifications; while BizChat is open, new messages are detected every five seconds.

Native Android and iOS builds register an FCM device token after login and send it to `/api/devices/push-token`; logout revokes that token, and token refreshes are re-registered automatically. Background push requires Firebase app configuration in the native build plus `FCM_SERVICE_ACCOUNT_BASE64` on the backend. iOS delivery also requires an APNs authentication key uploaded to Firebase, Apple signing, and verification on a signed device build.

Direct Chat also includes one-to-one audio and video calling through LiveKit. Set `EXPO_PUBLIC_REALTIME_URL` when Socket.IO is hosted on a different origin and `EXPO_PUBLIC_SOCKET_IO_PATH` when the backend uses a custom proxy path. Native calling requires a development build (`npm run ios` or `npm run android`); it does not run in Expo Go because LiveKit/WebRTC contains native modules. Background native call UI is deferred, so the full incoming-call screen currently appears while BizChat is active, with FCM supplying the background alert.

## Run

Keep the backend running on port `5001`, then:

```bash
cd mobile
npm start
```

Use `npm run ios`, `npm run android`, or `npm run web` for a specific target.

The default API address works for web and the iOS simulator. Android emulators
automatically use `http://10.0.2.2:5001/api`. For a physical phone, create
`mobile/.env` and set `EXPO_PUBLIC_API_URL` to the computer's LAN IP.

Production API:

```text
https://api.sahiproducts.com/bizchat/api
```

Production web app:

```text
https://bizchat-wine.vercel.app
```
