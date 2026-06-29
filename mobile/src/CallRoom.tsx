import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, CameraOff, Mic, MicOff, PhoneOff } from 'lucide-react-native';
import {
  AudioSession,
  isTrackReference,
  LiveKitRoom,
  registerGlobals,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  VideoTrack,
} from '@livekit/react-native';
import { Track } from 'livekit-client';
import { OutgoingRingback } from './CallTone';
import type { CallRoomProps } from './CallRoom.types';

registerGlobals();

function CallStage({ session, onEnd }: CallRoomProps) {
  const tracks = useTracks([Track.Source.Camera]);
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const [changingMedia, setChangingMedia] = useState(false);
  const connected = remoteParticipants.length > 0;
  const remoteTrack = tracks.find((track) => isTrackReference(track) && track.participant.identity !== localParticipant.identity);
  const localTrack = tracks.find((track) => isTrackReference(track) && track.participant.identity === localParticipant.identity);

  async function toggleMicrophone() {
    setChangingMedia(true);
    try { await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled); } finally { setChangingMedia(false); }
  }

  async function toggleCamera() {
    setChangingMedia(true);
    try { await localParticipant.setCameraEnabled(!isCameraEnabled); } finally { setChangingMedia(false); }
  }

  return (
    <View style={styles.page}>
      {!connected && session.call.status === 'ringing' ? <OutgoingRingback /> : null}
      <View style={styles.videoStage}>
        {remoteTrack && isTrackReference(remoteTrack) ? (
          <VideoTrack trackRef={remoteTrack} style={styles.remoteVideo} />
        ) : (
          <View style={styles.waiting}>
            <ActivityIndicator color="#ffffff" />
            <Text style={styles.waitingTitle}>{connected ? 'Connected' : session.call.status === 'ringing' ? 'Ringing…' : 'Connecting…'}</Text>
            <Text style={styles.waitingText}>{session.displayName}</Text>
          </View>
        )}
        {localTrack && isTrackReference(localTrack) ? <VideoTrack trackRef={localTrack} style={styles.localVideo} mirror /> : null}
        <View style={[styles.callStatus, connected && styles.callStatusConnected]}>
          <Text style={styles.callStatusText}>{connected ? 'Connected' : session.call.status === 'ringing' ? 'Ringing…' : 'Connecting…'}</Text>
        </View>
      </View>
      <View style={styles.controls}>
        <Pressable accessibilityLabel={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'} disabled={changingMedia} onPress={toggleMicrophone} style={styles.controlButton}>
          {isMicrophoneEnabled ? <Mic color="#ffffff" size={23} /> : <MicOff color="#ffffff" size={23} />}
        </Pressable>
        {session.call.call_type === 'video' ? (
          <Pressable accessibilityLabel={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'} disabled={changingMedia} onPress={toggleCamera} style={styles.controlButton}>
            {isCameraEnabled ? <Camera color="#ffffff" size={23} /> : <CameraOff color="#ffffff" size={23} />}
          </Pressable>
        ) : null}
        <Pressable accessibilityLabel="End call" onPress={onEnd} style={[styles.controlButton, styles.endButton]}>
          <PhoneOff color="#ffffff" size={25} />
        </Pressable>
      </View>
    </View>
  );
}

export default function CallRoom(props: CallRoomProps) {
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    let active = true;
    AudioSession.startAudioSession()
      .then(() => { if (active) setAudioReady(true); })
      .catch(props.onEnd);
    return () => {
      active = false;
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, []);

  if (!audioReady) {
    return (
      <View style={styles.page}>
        <View style={styles.waiting}>
          <ActivityIndicator color="#ffffff" />
          <Text style={styles.waitingTitle}>Preparing call…</Text>
        </View>
      </View>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={props.session.livekit.url}
      token={props.session.livekit.token}
      connect
      audio
      video={props.session.call.call_type === 'video'}
      options={{ adaptiveStream: true, dynacast: true }}
      onDisconnected={props.onEnd}
    >
      <CallStage {...props} />
    </LiveKitRoom>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#10161b' },
  videoStage: { flex: 1, position: 'relative' },
  remoteVideo: { flex: 1 },
  localVideo: { position: 'absolute', right: 16, top: 18, width: 112, height: 160, borderRadius: 12, overflow: 'hidden' },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  waitingTitle: { color: '#ffffff', fontSize: 24, fontWeight: '700', marginTop: 18 },
  waitingText: { color: '#aeb9c2', fontSize: 15, marginTop: 7 },
  callStatus: { position: 'absolute', top: 18, alignSelf: 'center', backgroundColor: '#3b4852', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  callStatusConnected: { backgroundColor: '#16845f' },
  callStatusText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  controls: { minHeight: 104, backgroundColor: '#1a2229', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 20, paddingBottom: 14 },
  controlButton: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#3b4852', alignItems: 'center', justifyContent: 'center' },
  endButton: { backgroundColor: '#c83b32' },
});
