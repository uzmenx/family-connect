import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react';
import { DailyCall, DailyParticipant } from '@daily-co/daily-js';
import { cn } from '@/lib/utils';

interface VideoCallUIProps {
  callObject: DailyCall;
  remoteParticipant: DailyParticipant | null;
  cameraOn: boolean;
  micOn: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onEndCall: () => void;
}

export const VideoCallUI = ({
  callObject,
  remoteParticipant,
  cameraOn,
  micOn,
  onToggleCamera,
  onToggleMic,
  onEndCall,
}: VideoCallUIProps) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!callObject) return;

    const updateLocalVideo = () => {
      const localParticipant = callObject.participants()?.local;
      if (localParticipant?.videoTrack && localVideoRef.current) {
        const stream = new MediaStream([localParticipant.videoTrack]);
        localVideoRef.current.srcObject = stream;
      }
    };

    const updateRemoteVideo = () => {
      if (remoteParticipant?.videoTrack && remoteVideoRef.current) {
        const stream = new MediaStream([remoteParticipant.videoTrack]);
        remoteVideoRef.current.srcObject = stream;
      }
      
      if (remoteParticipant?.audioTrack) {
        const audioEl = document.createElement('audio');
        audioEl.srcObject = new MediaStream([remoteParticipant.audioTrack]);
        audioEl.autoplay = true;
        audioEl.id = 'remote-audio';
        
        const existing = document.getElementById('remote-audio');
        if (existing) existing.remove();
        document.body.appendChild(audioEl);
      }
    };

    updateLocalVideo();
    
    callObject.on('participant-updated', () => {
      updateLocalVideo();
      updateRemoteVideo();
    });

    return () => {
      const audioEl = document.getElementById('remote-audio');
      if (audioEl) audioEl.remove();
    };
  }, [callObject]);

  useEffect(() => {
    if (remoteParticipant?.videoTrack && remoteVideoRef.current) {
      const stream = new MediaStream([remoteParticipant.videoTrack]);
      remoteVideoRef.current.srcObject = stream;
    }
    
    if (remoteParticipant?.audioTrack) {
      const audioEl = document.getElementById('remote-audio') as HTMLAudioElement;
      if (audioEl) {
        audioEl.srcObject = new MediaStream([remoteParticipant.audioTrack]);
      } else {
        const newAudioEl = document.createElement('audio');
        newAudioEl.srcObject = new MediaStream([remoteParticipant.audioTrack]);
        newAudioEl.autoplay = true;
        newAudioEl.id = 'remote-audio';
        document.body.appendChild(newAudioEl);
      }
    }
  }, [remoteParticipant]);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Remote video (full screen) */}
      <div className="absolute inset-0 bg-muted flex items-center justify-center">
        {remoteParticipant?.video ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center text-muted-foreground">
            <div className="w-24 h-24 bg-muted-foreground/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <VideoOff className="h-12 w-12" />
            </div>
            <p>Kutilmoqda...</p>
          </div>
        )}
      </div>

      {/* Local video (picture in picture) */}
      <div className="absolute top-4 right-4 w-32 h-44 rounded-xl overflow-hidden shadow-lg border-2 border-background">
        {cameraOn ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <VideoOff className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-0 right-0">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="lg"
            className={cn(
              "h-14 w-14 rounded-full",
              !cameraOn && "bg-muted-foreground text-muted"
            )}
            onClick={onToggleCamera}
          >
            {cameraOn ? (
              <Video className="h-6 w-6" />
            ) : (
              <VideoOff className="h-6 w-6" />
            )}
          </Button>

          <Button
            variant="destructive"
            size="lg"
            className="h-16 w-16 rounded-full"
            onClick={onEndCall}
          >
            <PhoneOff className="h-7 w-7" />
          </Button>

          <Button
            variant="outline"
            size="lg"
            className={cn(
              "h-14 w-14 rounded-full",
              !micOn && "bg-muted-foreground text-muted"
            )}
            onClick={onToggleMic}
          >
            {micOn ? (
              <Mic className="h-6 w-6" />
            ) : (
              <MicOff className="h-6 w-6" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
