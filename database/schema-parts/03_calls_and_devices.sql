CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id),
  group_id UUID REFERENCES groups(id),
  created_by UUID NOT NULL REFERENCES users(id),
  call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ringing', 'ongoing', 'ended', 'cancelled', 'declined', 'missed', 'failed')),
  room_name TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  ended_by UUID REFERENCES users(id),
  end_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  is_camera_on BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'joined', 'left', 'declined', 'missed', 'busy')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (call_id, user_id)
);

CREATE TABLE call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'ringing', 'accepted', 'declined', 'missed', 'busy', 'failed', 'joined', 'left', 'muted', 'unmuted', 'camera_on', 'camera_off', 'ended')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_type TEXT NOT NULL CHECK (device_type IN ('web', 'ios', 'android')),
  device_name TEXT,
  push_token TEXT,
  last_active_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
