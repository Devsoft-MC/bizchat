# BizChat Mobile

Expo React Native app for BizChat companies.
The authenticated company supplies the in-app company name and initials, so the same build supports multiple companies.

Users sign in with a company slug, an international-format mobile number, and a password. User administration stores each employee's work-location country code and timezone; the company timezone is the default.

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
