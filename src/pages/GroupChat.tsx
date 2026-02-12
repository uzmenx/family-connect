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
import { GroupSettingsSheet } from '@/components/groups/GroupSettingsSheet';
import { MessageContextMenu } from '@/components/chat/MessageContextMenu';
import { ForwardMessageDialog } from '@/components/chat/ForwardMessageDialog';
import { ReplyPreview } from '@/components/chat/ReplyPreview';
import { uploadMedia, uploadToR2 } from '@/lib/r2Upload';
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
  invite_link: string | null;
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

  // Settings sheet
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Reply & Forward
  const [replyTo, setReplyTo] = useState<{ id: string; content: string } | null>(null);
  const [forwardMessage, setForwardMessage] = useState<{ content: string; mediaUrl?: string | null; mediaType?: string | null } | null>(null);

  // Deleted messages (local storage for "delete for me")
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(new Set());

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

    // Load deleted messages from localStorage
    const stored = localStorage.getItem(`deleted_group_messages_${groupId}`);
    if (stored) {
      setDeletedMessageIds(new Set(JSON.parse(stored)));
    }
  }, [fetchGroupInfo, fetchMessages, groupId]);

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
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`
        },
        (payload) => {
          const deletedId = (payload.old as any).id;
          setMessages(prev => prev.filter(m => m.id !== deletedId));
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

      // Add reply prefix if replying
      if (replyTo) {
        const replyPreview = replyTo.content.length > 30 
          ? replyTo.content.substring(0, 30) + '...'
          : replyTo.content;
        content = `↩️ "${replyPreview}"\n${content}`;
        setReplyTo(null);
      }

      // Handle voice message
      if (voiceRecorder.audioBlob) {
        const audioFile = new File([voiceRecorder.audioBlob], `voice_${Date.now()}.webm`, {
          type: 'audio/webm'
        });
        mediaUrl = await uploadToR2(audioFile, `group-messages/${user.id}`);
        mediaType = 'audio';
        content = content || '🎤 Ovozli xabar';
        voiceRecorder.cancelRecording();
      }

      // Handle media (image/video)
      if (selectedMedia) {
        mediaUrl = await uploadMedia(selectedMedia.file, 'group-messages', user.id);
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

  const handleReply = (messageId: string, content: string) => {
    setReplyTo({ id: messageId, content });
  };

  const handleForward = (messageId: string, content: string) => {
    const msg = messages.find(m => m.id === messageId);
    setForwardMessage({
      content,
      mediaUrl: msg?.media_url,
      mediaType: msg?.media_type
    });
  };

  const handleDeleteForMe = (messageId: string) => {
    const newDeleted = new Set(deletedMessageIds);
    newDeleted.add(messageId);
    setDeletedMessageIds(newDeleted);
    localStorage.setItem(`deleted_group_messages_${groupId}`, JSON.stringify([...newDeleted]));
    toast.success('Xabar o\'chirildi');
  };

  const handleDeleteForAll = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('group_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
      toast.success('Xabar barcha uchun o\'chirildi');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Xatolik yuz berdi');
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

  // Filter out deleted messages
  const visibleMessages = messages.filter(m => !deletedMessageIds.has(m.id));

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
          <Avatar className="h-10 w-10 cursor-pointer" onClick={() => setSettingsOpen(true)}>
            <AvatarImage src={groupInfo?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10">
              {groupInfo?.type === 'group' ? (
                <Users className="h-5 w-5 text-primary" />
              ) : (
                <Megaphone className="h-5 w-5 text-primary" />
              )}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSettingsOpen(true)}>
            <h1 className="font-semibold truncate">{groupInfo?.name}</h1>
            <p className="text-xs text-muted-foreground">
              {groupInfo?.memberCount} a'zo
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {visibleMessages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Hozircha xabarlar yo'q</p>
            </div>
          ) : (
            visibleMessages.map((message, index) => {
              const isOwn = message.sender_id === user?.id;
              const showSender = !isOwn && (
                index === 0 || visibleMessages[index - 1].sender_id !== message.sender_id
              );

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <MessageContextMenu
                    messageContent={message.content}
                    messageId={message.id}
                    isMine={isOwn}
                    isPrivateChat={false}
                    onReply={handleReply}
                    onForward={handleForward}
                    onDeleteForMe={handleDeleteForMe}
                    onDeleteForAll={isOwn || groupInfo?.owner_id === user?.id ? handleDeleteForAll : undefined}
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
                  </MessageContextMenu>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Reply Preview */}
      {replyTo && (
        <ReplyPreview
          replyToContent={replyTo.content}
          onCancel={() => setReplyTo(null)}
        />
      )}

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

      {/* Group Settings Sheet */}
      {groupInfo && (
        <GroupSettingsSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          groupInfo={groupInfo}
          onGroupUpdated={fetchGroupInfo}
        />
      )}

      {/* Forward Dialog */}
      {forwardMessage && (
        <ForwardMessageDialog
          open={!!forwardMessage}
          onOpenChange={(open) => !open && setForwardMessage(null)}
          messageContent={forwardMessage.content}
          mediaUrl={forwardMessage.mediaUrl}
          mediaType={forwardMessage.mediaType}
        />
      )}
    </div>
  );
};

export default GroupChat;
