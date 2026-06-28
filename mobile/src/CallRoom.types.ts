import type { CallSession } from './types';

export type CallRoomProps = {
  session: CallSession;
  onEnd: () => void;
};
