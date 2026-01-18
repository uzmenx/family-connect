import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Users, Megaphone, MoreVertical, Send, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ChatMediaPicker } from '@/components/chat/ChatMediaPicker';
import { VoiceRecorderButton } from '@/components/chat/VoiceRecorderButton';
import { MediaMessage } from '@/components/chat/MediaMessage';
import { VoiceMessage } from '@/components/chat/VoiceMessage';
import { MediaFullscreen } from '@/components/chat/MediaFullscreen';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  sender?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  type: 'group' | 'channel';
  visibility: 'public' | 'private';
  owner_id: string;
  memberCount: number;
}

const GroupChat = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [canSend, setCanSend] = useState(false);

  // Media handling
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null);
  const [fullscreenMedia, setFullscreenMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const voiceRecorder = useVoiceRecorder();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchGroupInfo = useCallback(async () => {
    if (!groupId) return;

    try {
      const { data: group, error } = await supabase
        .from('group_chats')
        .select('*')
        .eq('id', groupId)
        .single();

      if (error) throw error;

      const { count: memberCount } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);

      setGroupInfo({
        ...group,
        memberCount: (memberCount || 0) + 1
      });

      // Check if user can send messages
      if (group.owner_id === user?.id) {
        setCanSend(true);
      } else if (group.type === 'group') {
        // In groups, all members can send
        const { data: membership } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', groupId)
          .eq('user_id', user?.id)
          .maybeSingle();
        setCanSend(!!membership);
      } else {
        // In channels, only owner can send
        setCanSend(group.owner_id === user?.id);
      }
    } catch (error) {
      console.error('Error fetching group info:', error);
      toast.error('Guruh topilmadi');
      navigate('/messages');
    }
  }, [groupId, user?.id, navigate]);

  const fetchMessages = useCallback(async () => {
    if (!groupId) return;

    try {
      const { data: messagesData, error } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (messagesData && messagesData.length > 0) {
        const senderIds = [...new Set(messagesData.map(m => m.sender_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', senderIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        setMessages(messagesData.map(m => ({
          ...m,
          sender: profileMap.get(m.sender_id)
        })));
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroupInfo();
    fetchMessages();
  }, [fetchGroupInfo, fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group-messages-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`
        },
        async (payload) => {
          const newMsg = payload.new as any;
          
          // Fetch sender profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, username, avatar_url')
            .eq('id', newMsg.sender_id)
            .single();

          setMessages(prev => [...prev, { ...newMsg, sender: profile }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!groupId || !user?.id || (!newMessage.trim() && !selectedMedia && !voiceRecorder.audioBlob)) return;
    if (isSending) return;

    setIsSending(true);

    try {
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;
      let content = newMessage.trim();

      // Handle voice message
      if (voiceRecorder.audioBlob) {
        const fileName = `voice_${Date.now()}.webm`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('message_media')
          .upload(filePath, voiceRecorder.audioBlob);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('message_media')
          .getPublicUrl(filePath);

        mediaUrl = publicUrl;
        mediaType = 'audio';
        content = content || '🎤 Ovozli xabar';
        voiceRecorder.cancelRecording();
      }

      // Handle media
      if (selectedMedia) {
        const fileExt = selectedMedia.file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('message_media')
          .upload(filePath, selectedMedia.file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('message_media')
          .getPublicUrl(filePath);

        mediaUrl = publicUrl;
        mediaType = selectedMedia.type;
        content = content || (selectedMedia.type === 'image' ? '📷 Rasm' : '🎬 Video');
        setSelectedMedia(null);
      }

      const { error } = await supabase
        .from('group_messages')
        .insert({
          group_id: groupId,
          sender_id: user.id,
          content: content || 'Xabar',
          media_url: mediaUrl,
          media_type: mediaType
        });

      if (error) throw error;

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Xabar yuborilmadi');
    } finally {
      setIsSending(false);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatMessageTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('uz-UZ', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderMessageContent = (message: GroupMessage) => {
    const isOwn = message.sender_id === user?.id;

    if (message.media_type === 'audio' && message.media_url) {
      return <VoiceMessage audioUrl={message.media_url} isMine={isOwn} />;
    }

    if ((message.media_type === 'image' || message.media_type === 'video') && message.media_url) {
      return (
        <MediaMessage
          mediaUrl={message.media_url}
          mediaType={message.media_type as 'image' | 'video'}
          isMine={isOwn}
          onFullscreen={() => setFullscreenMedia({ url: message.media_url!, type: message.media_type as 'image' | 'video' })}
        />
      );
    }

    return <p className="break-words">{message.content}</p>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/messages')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10">
            <AvatarImage src={groupInfo?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10">
              {groupInfo?.type === 'group' ? (
                <Users className="h-5 w-5 text-primary" />
              ) : (
                <Megaphone className="h-5 w-5 text-primary" />
              )}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">{groupInfo?.name}</h1>
            <p className="text-xs text-muted-foreground">
              {groupInfo?.memberCount} a'zo
            </p>
          </div>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Hozircha xabarlar yo'q</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isOwn = message.sender_id === user?.id;
              const showSender = !isOwn && (
                index === 0 || messages[index - 1].sender_id !== message.sender_id
              );

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${isOwn ? 'items-end' : 'items-start'}`}>
                    {showSender && (
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={message.sender?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(message.sender?.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium text-primary">
                          {message.sender?.name || message.sender?.username || 'Foydalanuvchi'}
                        </span>
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2 ${
                        isOwn
                          ? 'bg-primary text-primary-foreground rounded-tr-md'
                          : 'bg-muted rounded-tl-md'
                      }`}
                    >
                      {renderMessageContent(message)}
                      <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {formatMessageTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      {canSend ? (
        <div className="sticky bottom-0 bg-background border-t border-border p-4">
          {/* Voice recording */}
          {voiceRecorder.isRecording && (
            <div className="mb-3 flex items-center gap-3 p-3 bg-destructive/10 rounded-lg">
              <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm">Yozib olinmoqda... {formatDuration(voiceRecorder.duration)}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={voiceRecorder.cancelRecording}
              >
                Bekor qilish
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <ChatMediaPicker
              selectedMedia={selectedMedia}
              onMediaSelect={setSelectedMedia}
            />

            {!voiceRecorder.isRecording && !voiceRecorder.audioBlob ? (
              <>
                <Input
                  placeholder="Xabar yozing..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1"
                />
                {newMessage.trim() || selectedMedia ? (
                  <Button size="icon" onClick={handleSendMessage} disabled={isSending}>
                    <Send className="h-5 w-5" />
                  </Button>
                ) : (
                  <VoiceRecorderButton
                    isRecording={voiceRecorder.isRecording}
                    hasAudio={!!voiceRecorder.audioBlob}
                    duration={voiceRecorder.duration}
                    formatDuration={formatDuration}
                    onStartRecording={voiceRecorder.startRecording}
                    onStopRecording={voiceRecorder.stopRecording}
                    onCancelRecording={voiceRecorder.cancelRecording}
                    onSendAudio={handleSendMessage}
                  />
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-end gap-2">
                <VoiceRecorderButton
                  isRecording={voiceRecorder.isRecording}
                  hasAudio={!!voiceRecorder.audioBlob}
                  duration={voiceRecorder.duration}
                  formatDuration={formatDuration}
                  onStartRecording={voiceRecorder.startRecording}
                  onStopRecording={voiceRecorder.stopRecording}
                  onCancelRecording={voiceRecorder.cancelRecording}
                  onSendAudio={handleSendMessage}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="sticky bottom-0 bg-muted/50 border-t border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Faqat kanal egasi xabar yuborishi mumkin
          </p>
        </div>
      )}

      {/* Fullscreen media */}
      {fullscreenMedia && (
        <MediaFullscreen
          mediaUrl={fullscreenMedia.url}
          mediaType={fullscreenMedia.type}
          onClose={() => setFullscreenMedia(null)}
        />
      )}
    </div>
  );
};

export default GroupChat;
