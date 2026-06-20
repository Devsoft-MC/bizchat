# BizChat Database Structure

## 1. Design Principles
- Primary focus on one business organization first
- Keep the schema ready for future external/vendor collaboration
- Each table should be scoped to a company or organization where needed
- Keep message data fast for chat operations
- Use audit fields for traceability
- Support soft delete where appropriate

## 2. Core Tables

### companies
Stores top-level tenants.

Columns:
- id (UUID / PK)
- name
- slug
- country
- timezone
- address
- contact_mobile
- logo_url
- settings (JSONB)
- created_by (FK -> users.id, nullable)
- status
- created_at
- updated_at

### users
Stores system users.

Columns:
- id (UUID / PK)
- company_id (FK -> companies.id)
- first_name
- last_name
- employee_code
- job_title
- mobile_number
- country_code (ISO 3166-1 alpha-2 work-location country)
- timezone (IANA timezone for the user's work location; falls back to company timezone)
- email
- password_hash
- role
- profile_photo_url
- status
- last_login_at
- last_seen_at
- is_online
- created_by (FK -> users.id, nullable)
- deactivated_at
- deactivated_by (FK -> users.id, nullable)
- created_at
- updated_at

### departments
Stores business units within a company.

Columns:
- id (UUID / PK)
- company_id (FK)
- parent_department_id (FK -> departments.id, nullable)
- name
- description
- manager_user_id (FK -> users.id, nullable)
- created_by (FK -> users.id, nullable)
- status
- created_at
- updated_at

### user_departments
Maps users to departments.

Columns:
- id (UUID / PK)
- user_id (FK)
- department_id (FK)
- created_at

### groups
Stores named group definitions for team or special-purpose chats.

Columns:
- id (UUID / PK)
- company_id (FK -> companies.id)
- department_id (FK -> departments.id, nullable)
- name (required)
- description
- group_type (official / special / custom)
- scope_type (department / company / custom)
- privacy_type (public / private / restricted)
- approval_required
- is_system_group
- created_by (FK -> users.id)
- last_message_at
- status
- created_at
- updated_at

### group_members
Maps users to groups.

Columns:
- id (UUID / PK)
- group_id (FK -> groups.id)
- user_id (FK -> users.id)
- role (admin / member)
- joined_at
- left_at
- created_at

### conversations
Stores chat threads for direct or group discussions.

Columns:
- id (UUID / PK)
- company_id (FK -> companies.id)
- group_id (FK -> groups.id, nullable)
- conversation_type (direct / group)
- title
- created_by (FK -> users.id)
- last_message_id (FK -> messages.id, nullable)
- last_message_at
- is_archived
- metadata (JSONB)
- created_at
- updated_at

### conversation_members
Maps users to conversations.

Columns:
- id (UUID / PK)
- conversation_id (FK -> conversations.id)
- user_id (FK -> users.id)
- role (admin / member)
- joined_at
- left_at
- created_at

### messages
Stores chat messages.

Columns:
- id (UUID / PK)
- company_id (FK)
- conversation_id (FK)
- sender_id (FK -> users.id)
- message_type (text / image / file)
- reply_to_message_id (FK -> messages.id, nullable)
- content
- edited_at
- deleted_at
- deleted_by (FK -> users.id, nullable)
- metadata (JSONB)
- created_at
- updated_at

### message_statuses
Tracks delivery/read state.

Columns:
- id (UUID / PK)
- message_id (FK)
- user_id (FK)
- status (sent / delivered / read)
- updated_at

### attachments
Stores uploaded files.

Columns:
- id (UUID / PK)
- company_id (FK)
- message_id (FK, nullable)
- file_name
- file_path
- file_type
- mime_type
- file_size
- storage_provider
- checksum
- download_count
- uploaded_by
- created_at

### calls
Stores future voice/video call sessions linked to a conversation or group.

Columns:
- id (UUID / PK)
- company_id (FK -> companies.id)
- conversation_id (FK -> conversations.id, nullable)
- group_id (FK -> groups.id, nullable)
- created_by (FK -> users.id)
- call_type (audio / video)
- status (scheduled / ringing / ongoing / ended / cancelled)
- started_at
- ended_at
- created_at
- updated_at

### call_participants
Tracks participants for each call session.

Columns:
- id (UUID / PK)
- call_id (FK -> calls.id)
- user_id (FK -> users.id)
- joined_at
- left_at
- is_muted
- is_camera_on
- status (joined / left / declined / missed)
- created_at

### call_events
Stores event-level logs for call lifecycle tracking.

Columns:
- id (UUID / PK)
- call_id (FK -> calls.id)
- user_id (FK -> users.id, nullable)
- event_type (created / joined / left / muted / unmuted / camera_on / camera_off / ended)
- metadata
- created_at

### audit_logs
Tracks important actions.

Columns:
- id (UUID / PK)
- company_id (FK, nullable)
- actor_id (FK -> users.id, nullable)
- entity_type
- entity_id
- action
- ip_address
- user_agent
- before_data (JSONB)
- after_data (JSONB)
- metadata
- created_at

### user_devices
Stores web and mobile devices for push notifications, session visibility, and security review.

Columns:
- id (UUID / PK)
- company_id (FK -> companies.id)
- user_id (FK -> users.id)
- device_type (web / ios / android)
- device_name
- push_token
- last_active_at
- status
- created_at
- updated_at

### approval_requests
Stores approval flows for future administrative actions.

Columns:
- id (UUID / PK)
- company_id (FK -> companies.id)
- requested_by (FK -> users.id)
- request_type
- entity_type
- entity_id
- status (pending / approved / rejected / cancelled)
- approved_by (FK -> users.id, nullable)
- approved_at
- rejected_reason
- metadata (JSONB)
- created_at
- updated_at

### tasks
Stores future work management tasks.

Columns:
- id (UUID / PK)
- company_id (FK -> companies.id)
- department_id (FK -> departments.id, nullable)
- title
- description
- priority (low / normal / high / urgent)
- status (pending / in_progress / completed / cancelled)
- due_at
- created_by (FK -> users.id)
- approved_by (FK -> users.id, nullable)
- approved_at
- created_at
- updated_at

### task_assignees
Maps tasks to one or more users.

Columns:
- id (UUID / PK)
- task_id (FK -> tasks.id)
- user_id (FK -> users.id)
- assigned_by (FK -> users.id)
- status (assigned / accepted / completed / removed)
- assigned_at
- completed_at
- created_at

### announcements
Stores official company or department notices.

Columns:
- id (UUID / PK)
- company_id (FK -> companies.id)
- department_id (FK -> departments.id, nullable)
- title
- content
- priority (normal / important / urgent)
- published_by (FK -> users.id)
- published_at
- expires_at
- status
- created_at
- updated_at

### devices
Stores future facility devices such as lights, switches, and cameras.

Columns:
- id (UUID / PK)
- company_id (FK -> companies.id)
- department_id (FK -> departments.id, nullable)
- device_name
- device_type (light / switch / camera / other)
- location_name
- network_address
- status
- metadata (JSONB)
- created_at
- updated_at

### device_permissions
Controls which users or roles can access future facility devices.

Columns:
- id (UUID / PK)
- device_id (FK -> devices.id)
- user_id (FK -> users.id, nullable)
- role (nullable)
- permission_type (view / control / admin)
- granted_by (FK -> users.id)
- created_at

### device_action_logs
Tracks future facility actions such as switch on/off.

Columns:
- id (UUID / PK)
- company_id (FK -> companies.id)
- device_id (FK -> devices.id)
- actor_id (FK -> users.id)
- action
- previous_state
- new_state
- ip_address
- user_agent
- metadata (JSONB)
- created_at

### camera_streams
Stores future IP camera viewing configuration.

Columns:
- id (UUID / PK)
- company_id (FK -> companies.id)
- device_id (FK -> devices.id)
- stream_name
- stream_url
- access_type (internal / external / vpn)
- status
- metadata (JSONB)
- created_at
- updated_at

## 3. Suggested Indexes
- users(company_id, status)
- users(company_id, employee_code)
- users(company_id, mobile_number)
- departments(company_id, manager_user_id)
- groups(company_id, department_id, status)
- group_members(group_id, user_id)
- conversations(company_id, group_id, last_message_at)
- conversation_members(conversation_id, user_id)
- messages(conversation_id, created_at)
- messages(conversation_id, reply_to_message_id)
- message_statuses(message_id, user_id)
- user_devices(user_id, status)
- approval_requests(company_id, status, request_type)
- tasks(company_id, department_id, status, due_at)
- task_assignees(task_id, user_id)
- announcements(company_id, department_id, status)
- calls(company_id, status, started_at)
- call_participants(call_id, user_id)
- call_events(call_id, created_at)
- devices(company_id, department_id, device_type, status)
- device_permissions(device_id, user_id)
- device_action_logs(company_id, device_id, created_at)
- camera_streams(company_id, device_id, status)
- audit_logs(company_id, entity_type, entity_id)
- audit_logs(actor_id, created_at)

## 4. Suggested Constraints
- Each user belongs to exactly one company
- Each group must have a non-empty name
- A user can be a member of a group only if they belong to the same company
- If a group is department-scoped, its members should be valid for that department
- Users can only access messages for conversations they belong to
- Messages should be immutable after send (unless edit feature is added later)
- Soft-deleted records should retain deleted_at and deleted_by where user accountability is required
- Sensitive actions such as approvals, user deactivation, and device control must create audit log entries
- Device control and camera viewing must require explicit permission

## 5. Recommended Initial Schema Order
1. companies
2. users
3. departments
4. user_departments
5. groups
6. group_members
7. conversations
8. conversation_members
9. messages
10. message_statuses
11. attachments
12. calls
13. call_participants
14. call_events
15. user_devices
16. approval_requests
17. tasks
18. task_assignees
19. announcements
20. devices
21. device_permissions
22. device_action_logs
23. camera_streams
24. audit_logs

## 6. Notes for Future Growth
- Add read receipts and typing indicators if needed
- Add search indexes for message content once usage grows
- Add moderation or approval fields if special groups require admin review
- Reserve call tables now so voice/video features can be added without redesigning the core schema
- Keep the design flexible so external/vendor collaboration can be added later without major changes
- Keep facility control tables reserved but do not enable device actions until the core administration module is stable
- Treat light/electrical switch control and camera access as high-permission actions with audit logging

## 7. Implementation Notes
- Some nullable foreign keys create useful audit links but may be added after base table creation, such as companies.created_by and conversations.last_message_id
- Keep device control APIs disabled until permissions, audit logs, and emergency disable behavior are fully tested
- Store passwords only as strong password hashes, never plain text
- Avoid storing direct camera credentials in plain text; use secure configuration or encrypted storage when camera integration is added
