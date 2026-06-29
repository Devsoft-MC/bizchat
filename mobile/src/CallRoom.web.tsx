import { createElement, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, CameraOff, Mic, MicOff, PhoneOff } from 'lucide-react-native';
import { Room, RoomEvent, Track, type RemoteTrack, type RemoteTrackPublication, type RemoteParticipant } from 'livekit-client';
import { OutgoingRingback } from './CallTone';
import type { CallRoomProps } from './CallRoom.types';

export default function CallRoom({ session, onEnd }: CallRoomProps) {
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const [roomConnected, setRoomConnected] = useState(false);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(session.call.call_type === 'video');

  useEffect(() => {
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    const attachRemote = (track: RemoteTrack, _publication: RemoteTrackPublication, _participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Video && remoteVideoRef.current) track.attach(remoteVideoRef.current);
      if (track.kind === Track.Kind.Audio && remoteAudioRef.current) track.attach(remoteAudioRef.current);
    };
    const refreshRemoteConnection = () => setRemoteConnected(room.remoteParticipants.size > 0);
    room.on(RoomEvent.TrackSubscribed, attachRemote);
    room.on(RoomEvent.ParticipantConnected, refreshRemoteConnection);
    room.on(RoomEvent.ParticipantDisconnected, refreshRemoteConnection);
    room.on(RoomEvent.Disconnected, onEnd);
    room.connect(session.livekit.url, session.livekit.token)
      .then(async () => {
        await room.localParticipant.setMicrophoneEnabled(true);
        if (session.call.call_type === 'video') {
          const publication = await room.localParticipant.setCameraEnabled(true);
          publication?.track?.attach(localVideoRef.current!);
        }
        setRoomConnected(true);
        refreshRemoteConnection();
      })
      .catch(onEnd);
    return () => { room.disconnect(); };
  }, [session.livekit.url, session.livekit.token]);

  async function toggleMicrophone() {
    const next = !microphoneEnabled;
    await roomRef.current?.localParticipant.setMicrophoneEnabled(next);
    setMicrophoneEnabled(next);
  }

  async function toggleCamera() {
    const next = !cameraEnabled;
    const publication = await roomRef.current?.localParticipant.setCameraEnabled(next);
    if (next && publication?.track && localVideoRef.current) publication.track.attach(localVideoRef.current);
    setCameraEnabled(next);
  }

  return (
    <View style={styles.page}>
      {!remoteConnected && session.call.status === 'ringing' ? <OutgoingRingback /> : null}
      <View style={styles.videoStage}>
        {createElement('video', { ref: remoteVideoRef, autoPlay: true, playsInline: true, style: rawStyles.remoteVideo })}
        {createElement('audio', { ref: remoteAudioRef, autoPlay: true })}
        {session.call.call_type === 'video' ? createElement('video', { ref: localVideoRef, autoPlay: true, muted: true, playsInline: true, style: rawStyles.localVideo }) : null}
        {!remoteConnected ? <View style={styles.waiting}><ActivityIndicator color="#ffffff" /><Text style={styles.waitingTitle}>{session.call.status === 'ringing' ? 'Ringing…' : roomConnected ? 'Waiting for colleague…' : 'Connecting…'}</Text><Text style={styles.waitingText}>{session.displayName}</Text></View> : null}
        <View style={[styles.callStatus, remoteConnected && styles.callStatusConnected]}><Text style={styles.callStatusText}>{remoteConnected ? 'Connected' : session.call.status === 'ringing' ? 'Ringing…' : 'Connecting…'}</Text></View>
      </View>
      <View style={styles.controls}>
        <Pressable accessibilityLabel={microphoneEnabled ? 'Mute microphone' : 'Unmute microphone'} onPress={toggleMicrophone} style={styles.controlButton}>{microphoneEnabled ? <Mic color="#ffffff" size={23} /> : <MicOff color="#ffffff" size={23} />}</Pressable>
        {session.call.call_type === 'video' ? <Pressable accessibilityLabel={cameraEnabled ? 'Turn camera off' : 'Turn camera on'} onPress={toggleCamera} style={styles.controlButton}>{cameraEnabled ? <Camera color="#ffffff" size={23} /> : <CameraOff color="#ffffff" size={23} />}</Pressable> : null}
        <Pressable accessibilityLabel="End call" onPress={onEnd} style={[styles.controlButton, styles.endButton]}><PhoneOff color="#ffffff" size={25} /></Pressable>
      </View>
    </View>
  );
}

const rawStyles = {
  remoteVideo: { width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#10161b' },
  localVideo: { position: 'absolute', right: 16, top: 18, width: 150, height: 200, borderRadius: 12, objectFit: 'cover', transform: 'scaleX(-1)' },
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#10161b' },
  videoStage: { flex: 1, position: 'relative' },
  waiting: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 24 },
  waitingTitle: { color: '#ffffff', fontSize: 24, fontWeight: '700', marginTop: 18 },
  waitingText: { color: '#aeb9c2', fontSize: 15, marginTop: 7 },
  callStatus: { position: 'absolute', top: 18, alignSelf: 'center', backgroundColor: '#3b4852', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  callStatusConnected: { backgroundColor: '#16845f' },
  callStatusText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  controls: { minHeight: 104, backgroundColor: '#1a2229', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 20, paddingBottom: 14 },
  controlButton: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#3b4852', alignItems: 'center', justifyContent: 'center' },
  endButton: { backgroundColor: '#c83b32' },
});
