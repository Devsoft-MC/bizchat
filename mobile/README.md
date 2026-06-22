# BizChat Mobile

Expo React Native app for BizChat companies.
The authenticated company supplies the in-app company name and initials, so the same build supports multiple companies.

During development, the sign-in screen automatically uses the iCON Systems slug `icon`; users enter only their international-format mobile number and password. User administration stores each employee's work-location country code and timezone; the company timezone is the default.

Company Admins can list users, create accounts, activate or suspend users, edit user details and department assignments, and set a new password. Regular users see the company People Directory.

Company Admins and regular users can open People, select a colleague, and exchange stored one-to-one text messages. The first MVP refreshes messages every five seconds; Socket.IO realtime delivery is the next chat milestone.

On web, users can attach images, PDF, text, Word, and Excel files with the paperclip button or paste a clipboard image/file directly into an open chat. Attachments are limited to 10 MB and remain recipient-only. Native iOS/Android document selection is a following milestone.

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
