import { useEffect } from 'react';
import { useAudioPlayer } from 'expo-audio';

function LoopingCallTone({ source, volume }: { source: number; volume: number }) {
  const player = useAudioPlayer(source, { downloadFirst: true });

  useEffect(() => {
    player.loop = true;
    player.volume = volume;
    player.play();
    return () => {
      player.pause();
      player.seekTo(0).catch(() => {});
    };
  }, [player, volume]);

  return null;
}

export function IncomingRingtone() {
  return <LoopingCallTone source={require('../assets/sounds/incoming-ring.wav')} volume={0.85} />;
}

export function OutgoingRingback() {
  return <LoopingCallTone source={require('../assets/sounds/outgoing-ringback.wav')} volume={0.65} />;
}
