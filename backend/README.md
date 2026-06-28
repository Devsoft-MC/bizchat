# BizChat Backend

Express API for BizChat, backed by PostgreSQL.

## Run Locally

```bash
cd backend
npm install
npm run dev
```

The API runs at `http://localhost:5001` by default. Port 5001 is used because
macOS AirPlay commonly occupies port 5000.

Production is managed by PM2 as `bizchat-api`, bound to `127.0.0.1:5001`, and
proxied by Nginx at `https://api.sahiproducts.com/bizchat/api`.

## Verify

```bash
curl http://localhost:5001/api/health
curl http://localhost:5001/api/health/ready
npm test
```

## Initial Setup

`POST /api/setup` creates the first company and super admin. It works only when
the `companies` table is empty. After setup, authenticate with
`POST /api/auth/login` using the company slug, mobile number, and password.

## API Routes

- `GET /api/health` - API process health
- `GET /api/health/ready` - API and PostgreSQL readiness
- `POST /api/setup` - first company and super-admin setup
- Keep `/api/setup` limited to first installation; subsequent tenants must be created through authenticated `POST /api/companies`
- `POST /api/auth/login` - mobile-number and password login
- `GET /api/auth/me` - current authenticated user
- `POST /api/companies` - super-admin creation of another company, its first company admin, and initial departments
- `GET|PATCH /api/companies/current` - current company
- `GET|POST /api/departments` - list or create departments
- `DELETE /api/departments/:id` - deactivate a department
- `GET|POST /api/users` - list or create company users
- `GET /api/users/directory` - active colleagues in the authenticated user's company
- `PATCH /api/users/:id` - update a company user's details, role, and departments
- `PATCH /api/users/:id/password` - set a new password for a company user
- `PATCH /api/users/:id/status` - activate, suspend, or deactivate a user
- `POST /api/conversations/direct` - create or reuse a direct conversation with an active colleague
- `GET /api/conversations` - recipient-scoped conversation inbox with latest-message preview and unread count
- `GET /api/conversations/:id/messages` - list messages for an authenticated conversation member
- `POST /api/conversations/:id/read` - mark the signed-in recipient's unread messages as read
- `POST /api/conversations/:id/messages` - send a text message as an authenticated conversation member
- `POST /api/conversations/:id/attachments` - upload one private image, voice message, or document up to 10 MB
- `GET /api/conversations/:id/attachments/:attachmentId` - authenticated recipient download
- `POST /api/devices/push-token` - register or refresh the signed-in Android device's FCM token
- `DELETE /api/devices/push-token` - revoke the signed-in user's current device token on logout

Direct chats are private to exactly two active conversation members. Administrative roles do not grant access to conversations unless that administrator is one of those two recipients.
Attachment files are stored under `backend/uploads/chat` (or `CHAT_UPLOAD_DIR`) and are never served as a public static directory.
Audio attachments are stored through the same recipient-only route and recorded as `audio` messages. Existing databases must apply `database/migrations/002_voice_messages.sql` before deploying voice-message uploads.

Android background push requires `FCM_SERVICE_ACCOUNT_BASE64` in the private backend environment. Never commit the Firebase Admin service-account JSON. Invalid FCM tokens are automatically marked revoked after a failed delivery.

## Audio and Video Calls

Apply `database/migrations/003_livekit_calls.sql`, then configure `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`. Socket.IO uses `SOCKET_IO_PATH` (default `/socket.io`). Keep all LiveKit credentials in the private backend environment.

- `GET /api/calls/incoming` - get the current ringing call
- `GET /api/calls/history` - list the signed-in user's recent calls
- `POST /api/calls` - start a one-to-one audio or video call in a direct conversation
- `POST /api/calls/:callId/respond` - accept, decline, or mark a call busy
- `POST /api/calls/:callId/token` - obtain a short-lived, room-scoped LiveKit token
- `POST /api/calls/:callId/end` - end or cancel an active call

Production must route the public Socket.IO path to this Node process and provide a TLS-enabled LiveKit endpoint reachable by mobile devices. CallKit/PushKit-style background call presentation is intentionally deferred.

The VPS deployment templates use the existing `api.sahiproducts.com` certificate for LiveKit WebSockets at `/rtc`, while LiveKit media uses TCP `7881` and UDP `7882`. Install `livekit-server`, copy `deploy/livekit.yaml.example` to `/etc/livekit.yaml`, install `deploy/livekit.service`, open those two media ports in both the host and provider firewalls, and keep the generated API key/secret synchronized with the private BizChat `.env`.

## Create iCON Systems Locally

After applying `database/migrations/001_user_location.sql`, run:

```bash
npm run create-company -- --name "iCON Systems" --slug icon --country India --timezone Asia/Kolkata --admin-first Manoj --admin-last Chendran --mobile +966536547919 --email manojchendran@gmail.com --department Management
```

The command creates a strong temporary password and prints it once. Change it after the first login.

All protected routes require `Authorization: Bearer <token>`. Company scoping is
taken from the signed JWT and is never accepted from client request data.
