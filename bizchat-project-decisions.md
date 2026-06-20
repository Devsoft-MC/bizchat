# BizChat Project Decisions

This file captures the agreed decisions for the new business communication application.

## Project Idea

Build a private communication application for business units and companies.

The app should support internal communication such as:

- One-to-one chat
- Group chat
- File/image sharing
- Mobile notifications
- Future voice calls
- Future video calls
- Future group calls
- Future facility controls such as light switch on/off and electrical switch control
- Future IP camera viewing

## First Platform Decision

We will start with:

- Web app
- Mobile app
- Backend API
- PostgreSQL database
- Existing VPS hosting

The first version will focus on chatting only.

Facility controls and IP camera views are future expansion features, not part of the first chat-focused version.

## Monthly Cost Decision

Initial version should avoid extra monthly fees as much as possible.

Agreed approach:

- Use existing VPS
- Use PostgreSQL
- Use free Firebase Cloud Messaging for mobile push notifications later
- Do not use SMS OTP initially
- Do not use paid voice/video providers initially
- Store files on VPS initially if file sharing is added

Expected extra monthly cost at the beginning:

- Development/testing stage: zero extra monthly fee, excluding existing VPS/PostgreSQL/domain
- Production mobile publishing later:
  - Apple Developer account: USD 99 per year, only needed for iPhone App Store/TestFlight publishing
  - Google Play Developer account: USD 25 one-time, only needed for Android Play Store publishing

## MVP Scope

Version 1 should include:

- Login
- Company setup
- User management
- User list
- One-to-one chat
- Group chat
- Realtime messaging
- Message delivery/read status
- Basic admin controls

Version 1 should not include:

- Voice calling
- Video calling
- Group calling
- Light or electrical switch control
- IP camera viewing
- SMS OTP
- End-to-end encryption
- Paid cloud storage
- Complex compliance export

## System Type

The system should be multi-company from the beginning.

This means each company has its own:

- Users
- Business units/departments
- Chats
- Groups
- Admins
- Data boundary

Even if the first use is for one company, the database and backend should be ready for multiple companies later.

## Login Method

Initial login method:

- Mobile number
- Password

No SMS OTP in the first version.

SMS OTP can be added later if needed.

## User Roles

Initial roles:

### Super Admin

- Creates companies
- Manages global system settings
- Can deactivate companies

### Company Admin

- Manages users inside one company
- Creates departments/business units
- Creates official groups
- Can deactivate users

### User

- Can send and receive messages
- Can join assigned groups
- Can use normal chat features

## Recommended Technology Stack

| Layer | Recommended Technology |
| --- | --- |
| Backend | Node.js with Express or NestJS |
| Realtime | Socket.IO |
| Database | PostgreSQL |
| Web App | React or Next.js |
| Mobile App | React Native |
| Notifications | Firebase Cloud Messaging |
| Hosting | Existing VPS |
| File Storage | VPS storage initially |

## Suggested Folder Structure

```text
bizchat/
  backend/
  web/
  mobile/
  database/
  docs/
```

## Database Direction

Initial main tables:

- companies
- business_units
- users
- conversations
- conversation_members
- messages
- message_statuses
- attachments

Future facility module tables can be added later for devices, device permissions, switch actions, camera streams, and audit logs.

## Development Order

Recommended development order:

1. Create backend project
2. Create PostgreSQL schema
3. Build authentication
4. Build company and user management
5. Build one-to-one chat APIs
6. Add Socket.IO realtime messaging
7. Build web login and chat screen
8. Build mobile login and chat screen
9. Add group chat
10. Add push notifications

## Current Recommendation

Start with the backend foundation first.

Reason:

The backend controls users, companies, login, permissions, chats, and realtime messaging. Once the backend is stable, both web and mobile apps can use the same API.

## Temporary Project Name

Temporary name:

BizChat

This can be changed later.
