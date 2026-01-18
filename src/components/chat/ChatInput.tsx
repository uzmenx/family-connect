import { useState, useRef, useEffect } from 'react';
import { Send, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatMediaPicker } from './ChatMediaPicker';
import { VoiceRecorderButton } from './VoiceRecorderButton';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

interface ChatInputProps {
  conversationId: string | null;
  onSendMessage: (content: string, mediaUrl?: string, mediaType?: string) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
}

export const ChatInput = ({ conversationId, onSendMessage, onTyping }: ChatInputProps) => {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    isRecording,
    duration,
    audioBlob,
    startRecording,
    stopRecording,
    cancelRecording,
    clearAudio,
    formatDuration
  } = useVoiceRecorder();

  const uploadMedia = async (file: File, type: string): Promise<string | null> => {
    if (!user?.id) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('message_media')
      .upload(fileName, file);

    if (error) {
      console.error('Upload error:', error);
      toast.error('Fayl yuklashda xatolik');
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('message_media')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSend = async () => {
    if (!conversationId) return;

    setIsUploading(true);

    try {
      // Handle media message
      if (selectedMedia) {
        const mediaUrl = await uploadMedia(selectedMedia.file, selectedMedia.type);
        if (mediaUrl) {
          await onSendMessage(inputValue.trim() || '', mediaUrl, selectedMedia.type);
          URL.revokeObjectURL(selectedMedia.preview);
          setSelectedMedia(null);
        }
      } else if (inputValue.trim()) {
        // Handle text message
        await onSendMessage(inputValue.trim());
      }

      setInputValue('');
      onTyping(false);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Xabar yuborishda xatolik');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendAudio = async () => {
    if (!audioBlob || !conversationId) return;

    setIsUploading(true);

    try {
      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, {
        type: 'audio/webm'
      });

      const mediaUrl = await uploadMedia(audioFile, 'audio');
      if (mediaUrl) {
        await onSendMessage('🎤 Ovozli xabar', mediaUrl, 'audio');
      }

      clearAudio();
    } catch (error) {
      console.error('Error sending audio:', error);
      toast.error('Ovozli xabar yuborishda xatolik');
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    onTyping(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const showSendButton = inputValue.trim() || selectedMedia;
  const showVoiceButton = !inputValue.trim() && !selectedMedia && !isRecording && !audioBlob;

  return (
    <div className="sticky bottom-0 bg-background border-t border-border p-3 safe-area-bottom">
      {/* Selected media preview */}
      {selectedMedia && (
        <div className="mb-3">
          <ChatMediaPicker 
            selectedMedia={selectedMedia}
            onMediaSelect={setSelectedMedia}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* Media picker (only show when not recording) */}
        {!isRecording && !audioBlob && (
          <ChatMediaPicker 
            selectedMedia={null}
            onMediaSelect={setSelectedMedia}
          />
        )}

        {/* Input field (hide when recording or has audio) */}
        {!isRecording && !audioBlob ? (
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Xabar yozing..."
            className="flex-1"
            disabled={isUploading}
          />
        ) : (
          <div className="flex-1" />
        )}

        {/* Voice recorder or Send button */}
        {isRecording || audioBlob ? (
          <VoiceRecorderButton
            isRecording={isRecording}
            duration={duration}
            hasAudio={!!audioBlob}
            formatDuration={formatDuration}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onCancelRecording={cancelRecording}
            onSendAudio={handleSendAudio}
          />
        ) : showSendButton ? (
          <Button 
            size="icon" 
            onClick={handleSend}
            disabled={isUploading}
          >
            <Send className="h-5 w-5" />
          </Button>
        ) : (
          <VoiceRecorderButton
            isRecording={false}
            duration={0}
            hasAudio={false}
            formatDuration={formatDuration}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onCancelRecording={cancelRecording}
            onSendAudio={handleSendAudio}
          />
        )}
      </div>
    </div>
  );
};
