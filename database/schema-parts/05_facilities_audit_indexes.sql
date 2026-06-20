CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id),
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('light', 'switch', 'camera', 'other')),
  location_name TEXT,
  network_address TEXT,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'maintenance', 'disabled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE device_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT,
  permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'control', 'admin')),
  granted_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR role IS NOT NULL)
);

CREATE TABLE device_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  previous_state TEXT,
  new_state TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE camera_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  stream_name TEXT NOT NULL,
  stream_url TEXT NOT NULL,
  access_type TEXT NOT NULL DEFAULT 'internal' CHECK (access_type IN ('internal', 'external', 'vpn')),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'disabled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_company_status ON users(company_id, status);
CREATE INDEX idx_users_company_employee_code ON users(company_id, employee_code);
CREATE INDEX idx_users_company_mobile_number ON users(company_id, mobile_number);
CREATE INDEX idx_departments_company_manager ON departments(company_id, manager_user_id);
CREATE INDEX idx_groups_company_department_status ON groups(company_id, department_id, status);
CREATE INDEX idx_group_members_group_user ON group_members(group_id, user_id);
CREATE INDEX idx_conversations_company_group_last_message ON conversations(company_id, group_id, last_message_at);
CREATE INDEX idx_conversation_members_conversation_user ON conversation_members(conversation_id, user_id);
CREATE INDEX idx_messages_conversation_created_at ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_conversation_reply ON messages(conversation_id, reply_to_message_id);
CREATE INDEX idx_message_statuses_message_user ON message_statuses(message_id, user_id);
CREATE INDEX idx_user_devices_user_status ON user_devices(user_id, status);
CREATE INDEX idx_approval_requests_company_status_type ON approval_requests(company_id, status, request_type);
CREATE INDEX idx_tasks_company_department_status_due ON tasks(company_id, department_id, status, due_at);
CREATE INDEX idx_task_assignees_task_user ON task_assignees(task_id, user_id);
CREATE INDEX idx_announcements_company_department_status ON announcements(company_id, department_id, status);
CREATE INDEX idx_calls_company_status_started ON calls(company_id, status, started_at);
CREATE INDEX idx_call_participants_call_user ON call_participants(call_id, user_id);
CREATE INDEX idx_call_events_call_created ON call_events(call_id, created_at);
CREATE INDEX idx_devices_company_department_type_status ON devices(company_id, department_id, device_type, status);
CREATE INDEX idx_device_permissions_device_user ON device_permissions(device_id, user_id);
CREATE INDEX idx_device_action_logs_company_device_created ON device_action_logs(company_id, device_id, created_at);
CREATE INDEX idx_camera_streams_company_device_status ON camera_streams(company_id, device_id, status);
CREATE INDEX idx_audit_logs_company_entity ON audit_logs(company_id, entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor_created ON audit_logs(actor_id, created_at);
