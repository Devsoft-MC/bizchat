# BizChat

BizChat is a business communication platform mainly for internal collaboration within one organization first, with later support for vendors or external collaborators if needed.

## Project Goals
- Support one-to-one and group messaging for internal business users
- Support department-level and team-level organization
- Keep access boundaries clear for one business group first
- Prepare the system for future voice/video calls
- Allow future expansion for external partners or vendors
- Keep the architecture open for future facility controls such as lights, electrical switches, and IP camera viewing

## Product Direction
- First priority: internal team communication and collaboration
- Second priority: business unit administration features
- Third priority: optional support for vendors and external users later
- Keep the design flexible enough for future organization expansion

## Current MVP Scope
- Login and user management
- Company setup
- Department setup
- Group creation and membership
- Direct and group conversations
- Message delivery/read status
- Basic admin controls

## Recommended Feature Roadmap

### Phase 1: Communication MVP
- Login and user management
- Company and department setup
- One-to-one chat
- Group chat
- Realtime messaging
- Message delivery and read status
- Basic admin controls

### Phase 2: Business Administration
- Company dashboard
- Department and business unit management
- Employee/user administration
- Role-based permissions
- Activity logs for important actions
- User active/inactive control
- Approval levels for sensitive actions
- Internal announcements

### Phase 3: Work Management
- Task assignment
- Task status tracking
- Due dates and reminders
- Department-wise task boards
- Manager approval for completed work
- Daily work summary

### Phase 4: Staff Administration
- Attendance entry
- Leave request and approval
- Staff availability status
- Shift or duty roster
- Late and absent reports

### Phase 5: Documents and Requests
- Internal file sharing
- Company document storage
- Department-wise documents
- Document approval flow
- Important notices and circulars
- Complaint or request tracking
- Maintenance request tracking
- Purchase or expense request approval
- Visitor or vendor entry records

### Phase 6: Reports
- Department activity report
- Employee activity report
- Pending task report
- Attendance report
- Admin action report
- Approval status report

### Phase 7: Facility and Smart Office Controls
- Light switch on/off control
- Electrical switch control
- IP camera viewing
- Device access permissions
- Device action history
- Emergency disable controls
- Device usage and action reports

Facility and smart office controls should be added only after the core communication and administration system is stable.

## Recommended Tech Direction
- Backend: Node.js with Express or NestJS
- Realtime: Socket.IO
- Database: PostgreSQL
- Web: React or Next.js
- Mobile: React Native
- Hosting: existing VPS

## Documentation
- [bizchat-project-decisions.md](bizchat-project-decisions.md)
- [docs/sdlc.md](docs/sdlc.md)
- [docs/db-structure.md](docs/db-structure.md)
- [database/README.md](database/README.md)
- [backend/README.md](backend/README.md)
- [mobile/README.md](mobile/README.md)

## Local Development Database
- Use PostgreSQL locally first to reduce VPS dependency during early development
- Recommended local database name: `bizchat_local`
- Schema file: [database/schema.sql](database/schema.sql)
- Backend local env file: [backend/.env.example](backend/.env.example)

## Production Database
- Host: Hostinger VPS
- PostgreSQL database: `bizchatdb`
- Application role: `bizchat_app`
- PostgreSQL remains private; remote administration uses a DBeaver SSH tunnel

## Current Progress
- Project planning documents are created
- Feature roadmap is documented in this README
- Database structure is documented in [docs/db-structure.md](docs/db-structure.md)
- Local PostgreSQL database was created: `bizchat_local`
- Local schema was loaded successfully from [database/schema.sql](database/schema.sql)
- Verified local database table count: 24 tables
- Backend environment files were added under `backend/`
- `.gitignore` was added to avoid committing local env files and build output
- Express backend foundation is implemented under `backend/`
- Health and PostgreSQL readiness APIs are available on local port `5001`
- Initial company setup and mobile-number/password JWT login are implemented
- Protected company, department, and user management APIs are implemented
- Backend API tests cover health, validation, authentication, tenant scoping, and 404 responses
- Expo React Native mobile app is available under `mobile/`
- Mobile Super Admin flow supports login and user creation with department assignment
- Sri Vallavan Finance is configured with company slug `finance`
- Super Admin account is created and login is verified
- Administration, Accounts, Management, and Collection departments are active
- Mobile login uses company slug, mobile number, and password; email login is not enabled
- Mobile TypeScript check passes and Expo Doctor passes all 21 checks
- Mobile login and create-user screens passed the phone-sized visual smoke check
- Backend test suite passes all 6 tests
- Secure second-company creation is implemented for authenticated Super Admins
- Mobile branding now follows the authenticated company instead of being fixed to Sri Vallavan Finance
- International-format mobile numbers and per-user work-location country/timezone fields are implemented
- iCON Systems onboarding is prepared with slug `icon`, country India, default timezone `Asia/Kolkata`, and Management department
- The existing local database still needs `database/migrations/001_user_location.sql` applied before creating iCON Systems because PostgreSQL access was unavailable in the managed session
- Hostinger VPS production database `bizchatdb` is created and owned by `bizchat_app`
- Production schema verification passed: 24 tables, 0 missing tables, 25 custom indexes, `audit_logs` present, `pgcrypto` present, and 0 invalid constraints
- Backend/schema field alignment, backend JavaScript syntax, international-number unit handling, and mobile TypeScript compilation were rechecked successfully against the production schema
- iCON Systems is created in production with slug `icon`, Manoj Chendran as active Company Admin, Management department membership, and a repaired `companies.created_by` audit link
- BizChat backend is deployed on the Hostinger VPS under PM2 as `bizchat-api`, bound privately to `127.0.0.1:5001`
- Nginx exposes the API at `https://api.sahiproducts.com/bizchat/api` without changing Sri Vallavan's existing `/api/` route
- HTTPS is enabled with a dedicated Let's Encrypt certificate for `api.sahiproducts.com`
- Production health and database-readiness checks pass over public HTTPS
- PostgreSQL now listens only on VPS localhost and the exposed database password was rotated into the private backend environment
- Mobile local environment now targets the production HTTPS API
- Mobile now opens on a tenant-scoped User List after login instead of remaining on Create User
- User List shows iCON Systems branding, role, mobile, department, and active/suspended status for each account
- Mobile admins can navigate to Add User, return automatically to Users after creation, refresh the list, and activate/suspend other users without suspending themselves
- Production user-list API now includes department names and was deployed under PM2; visual verification passed with all three iCON accounts and no browser errors
- Mobile landing is role-aware: Company Admins open User Administration while regular users open a read-only People Directory
- Mobile admins can open a User Details screen, edit employee/contact/access fields, and update department assignments
- Mobile admins can set a new password for a company user from a dedicated Change Password screen
- User updates and password resets are company-scoped in the backend, and admins cannot remove their own administrator role
- Production `bizchat-api` now includes the user edit and password-reset routes; PM2 restart and public HTTPS health verification passed
- Direct Chat MVP is implemented: users and Company Admins can open People, start or reuse a one-to-one conversation, load stored messages, send text messages, and receive five-second refresh updates
- Direct conversations and messages enforce authenticated company membership on the backend; the production route is deployed under PM2
- Direct-chat privacy is recipient-only: only the two active conversation members can read or send messages, and Company Admin/Super Admin roles receive no chat-viewing bypass
- BizChat web Direct Chat supports private image/document attachments through the paperclip button and direct clipboard image/file paste; files are limited to 10 MB and downloads require conversation membership
- Direct Chat supports private voice messages with microphone recording, cancel or stop-and-send controls, authenticated in-chat playback, and voice-specific inbox/push previews
- Web message notifications are implemented: recipient-specific unread counts, a notification inbox, read-state updates when chats open, and optional browser alerts while BizChat is running
- Android FCM plumbing is implemented locally: native token registration, authenticated device storage, message-triggered multicast sends, logout revocation, and automatic retirement of invalid tokens
- A fresh Firebase-enabled Android release APK was built successfully; the private Firebase Admin service account and authenticated device-token route are deployed on the VPS, with a two-device background-delivery test still pending
- The iOS Firebase Messaging client is integrated locally with FCM token registration and refresh handling; signed-device delivery still needs Apple signing, an APNs key in Firebase, and physical-device verification
- The production `/api/users/directory` endpoint returns only active colleagues from the signed-in user's company, excludes the requester, and does not expose admin-only contact/status controls
- Production verification as Mrudul's real `user` role returned HTTP 200 with both active Manoj colleagues; the admin visual regression also passed without browser errors
- Expo web production is deployed on Vercel at `https://bizchat-wine.vercel.app` and visually verified with the production API configuration
- Vercel web requests use the same-origin `/api` path, which Vercel securely proxies to the VPS API to avoid client-side DNS and cross-origin connectivity problems
- During development, sign-in defaults internally to company slug `icon`, so users enter only their mobile number and password
- Express trusts the single production Nginx proxy so login rate limiting reads forwarded visitor addresses correctly
- GitHub source is available at `https://github.com/Devsoft-MC/bizchat` on branch `main`

## Local Run

Start the backend:

```bash
cd backend
npm run dev
```

Backend URL: `http://localhost:5001`

Start the mobile app in another terminal:

```bash
cd mobile
npm start
```

Web preview URL: `http://localhost:8081`

## iOS Version Progress

Completed locally on 28 June 2026:

- Firebase iOS app configuration is connected with bundle ID `com.devsoftmc.bizchat` and `GoogleService-Info.plist`
- React Native Firebase App and Messaging clients are installed and linked through CocoaPods
- iOS now requests notification permission, obtains an FCM registration token, registers it with `/api/devices/push-token`, re-registers refreshed tokens, and revokes the token on logout
- Push Notifications entitlement, remote-notification background mode, foreground banner/sound/badge presentation, and static Firebase framework linking are configured
- Firebase-enabled iOS simulator compilation succeeds in Xcode 26.5
- Mobile TypeScript checking, Expo web export, Expo Doctor 21/21, and backend tests 15/15 pass

Deferred Apple account and physical-device work:

- Enroll in the paid Apple Developer Program; the currently configured free Personal Team does not support the Push Notifications capability
- After enrollment, add the paid development team to Xcode and create the signing certificate/provisioning profile for `com.devsoftmc.bizchat`
- Create an APNs authentication key in the Apple Developer account and upload it to Firebase Cloud Messaging with its Key ID and Apple Team ID
- Connect, trust, and enable Developer Mode on a physical iPhone
- Make a signed iPhone build, sign in to BizChat, confirm the iOS FCM token is stored in `user_devices`, and verify foreground, background, and terminated-app message delivery

## Tomorrow Start Point
- Install the latest APK on two physical Android devices and verify token registration plus background notification delivery
- Resume the deferred iOS Apple signing/APNs/physical-device checklist above after paid Apple Developer enrollment is active
- Add backend integration tests using a disposable PostgreSQL test database
- Continue with department update APIs after the mobile flow is verified

## Audio and Video Calling Progress

Completed and deployed on 28 June 2026:

- One-to-one audio and video call buttons are available in Direct Chat, with incoming-call answer/decline screens and in-call microphone, camera, and hang-up controls
- Authenticated call creation, response, session-token, history, and end APIs enforce company and direct-conversation membership
- LiveKit room tokens are short-lived and restricted to one call room; the browser and native Android/iOS clients use the same call flow
- Socket.IO sends incoming and updated call state in realtime, with API polling retained as a recovery fallback
- Incoming calls also trigger FCM alerts for registered devices
- Database migration `database/migrations/003_livekit_calls.sql`, backend tests, mobile type checking, web export, iOS simulator compilation, Android standalone APK build, and native LiveKit/WebRTC linking are complete
- Production `bizchat-api` includes the authenticated call routes, and both voice-message migration `002` and call migration `003` are applied to `bizchatdb`
- LiveKit Server `1.13.2` runs under systemd on the Hostinger VPS; Nginx exposes its TLS WebSocket endpoint at `https://api.sahiproducts.com/rtc`, with TCP `7881` and UDP `7882` available for media
- Production Socket.IO is proxied at `/bizchat/socket.io`, the updated web app is deployed to `https://bizchat-wine.vercel.app`, and Android standalone build `1.0.1` packages the production realtime configuration

Remaining device work:

- Build and test with two signed-in physical devices on separate networks, including microphone/camera permissions, reconnect, decline, and hang-up behavior
- If an office Wi-Fi filter blocks `api.sahiproducts.com`, perform the first media test on mobile data; the current development network classifies that direct host incorrectly even though the same API works through the Vercel proxy
- Native background incoming-call UI (iOS CallKit/PushKit and the Android equivalent) remains deferred as agreed; the current call screen works while BizChat is active and FCM provides the background alert

## Notes on Future Growth
- Group naming and membership rules should be enforced in the application logic
- External/vendor collaboration is a later-stage expansion, not the immediate MVP focus
- Facility control features such as switch on/off controls and IP camera views should be treated as a separate future module with strict permissions and audit logging
