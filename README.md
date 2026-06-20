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
- The production `/api/users/directory` endpoint returns only active colleagues from the signed-in user's company, excludes the requester, and does not expose admin-only contact/status controls
- Production verification as Mrudul's real `user` role returned HTTP 200 with both active Manoj colleagues; the admin visual regression also passed without browser errors

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

## Tomorrow Start Point
- Add User Details/Edit screen
- Add Change Password screen
- Build Direct Chat from People Directory
- Add backend integration tests using a disposable PostgreSQL test database
- Continue with department and user update APIs after the mobile flow is verified

## Notes on Future Growth
- Voice and video call support should be planned now using reserved schema tables
- Group naming and membership rules should be enforced in the application logic
- External/vendor collaboration is a later-stage expansion, not the immediate MVP focus
- Facility control features such as switch on/off controls and IP camera views should be treated as a separate future module with strict permissions and audit logging
