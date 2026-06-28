BEGIN;

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS room_name TEXT,
  ADD COLUMN IF NOT EXISTS ended_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS end_reason TEXT;

UPDATE calls SET room_name = 'bizchat-existing-' || id::text WHERE room_name IS NULL;
ALTER TABLE calls ALTER COLUMN room_name SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_room_name ON calls(room_name);

ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_status_check;
ALTER TABLE calls
  ADD CONSTRAINT calls_status_check
  CHECK (status IN ('scheduled', 'ringing', 'ongoing', 'ended', 'cancelled', 'declined', 'missed', 'failed'));

ALTER TABLE call_participants DROP CONSTRAINT IF EXISTS call_participants_status_check;
ALTER TABLE call_participants ALTER COLUMN status SET DEFAULT 'invited';
ALTER TABLE call_participants
  ADD CONSTRAINT call_participants_status_check
  CHECK (status IN ('invited', 'accepted', 'joined', 'left', 'declined', 'missed', 'busy'));

ALTER TABLE call_events DROP CONSTRAINT IF EXISTS call_events_event_type_check;
ALTER TABLE call_events
  ADD CONSTRAINT call_events_event_type_check
  CHECK (event_type IN ('created', 'ringing', 'accepted', 'declined', 'missed', 'busy', 'failed', 'joined', 'left', 'muted', 'unmuted', 'camera_on', 'camera_off', 'ended'));

COMMIT;
