import { useEffect } from 'react';
import { setIsAudioActiveAsync, useAudioPlayer } from 'expo-audio';

export async function stopCallToneAudio() {
  await setIsAudioActiveAsync(false);
}

function LoopingCallTone({ source, volume }: { source: number; volume: number }) {
  const player = useAudioPlayer(source, { downloadFirst: true });

  useEffect(() => {
    let active = true;
    player.loop = true;
    player.volume = volume;
    setIsAudioActiveAsync(true)
      .then(() => { if (active) player.play(); })
      .catch(() => {});
    return () => {
      active = false;
      player.pause();
      stopCallToneAudio().catch(() => {});
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
