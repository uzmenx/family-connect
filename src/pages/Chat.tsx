import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages, Message } from '@/hooks/useMessages';
import { useConversations } from '@/hooks/useConversations';
import { useVideoCall } from '@/hooks/useVideoCall';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, CheckCheck, Video, Loader2, Clock } from 'lucide-react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { uz } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { VideoCallUI } from '@/components/chat/VideoCallUI';
import { IncomingCallDialog } from '@/components/chat/IncomingCallDialog';
import { ChatInput } from '@/components/chat/ChatInput';
import { VoiceMessage } from '@/components/chat/VoiceMessage';
import { MediaMessage } from '@/components/chat/MediaMessage';
import { MediaFullscreen } from '@/components/chat/MediaFullscreen';
import { MessageContextMenu } from '@/components/chat/MessageContextMenu';
import { ForwardMessageDialog } from '@/components/chat/ForwardMessageDialog';
import { ReplyPreview } from '@/components/chat/ReplyPreview';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

const Chat = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getOrCreateConversation } = useConversations();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreenMedia, setFullscreenMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  const { messages, isLoading, otherUserTyping, sendMessage, setTyping, refetch } = useMessages(conversationId);
  
  const {
    isInCall,
    isCreatingRoom,
    incomingCall,
    cameraOn,
    micOn,
    callObject,
    remoteParticipant,
    startCall,
    answerCall,
    declineCall,
    leaveCall,
    toggleCamera,
    toggleMic,
  } = useVideoCall(userId || null);

  // Reply & Forward
  const [replyTo, setReplyTo] = useState<{ id: string; content: string } | null>(null);
  const [forwardMessage, setForwardMessage] = useState<{ content: string; mediaUrl?: string | null; mediaType?: string | null } | null>(null);

  // Deleted messages (local storage for "delete for me")
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(new Set());

  // Initialize conversation
  useEffect(() => {
    const init = async () => {
      if (!userId || !user?.id) return;

      const convId = await getOrCreateConversation(userId);
      setConversationId(convId);

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .eq('id', userId)
        .maybeSingle();

      setOtherUser(profile);

      // Load deleted messages from localStorage
      if (convId) {
        const stored = localStorage.getItem(`deleted_messages_${convId}`);
        if (stored) {
          setDeletedMessageIds(new Set(JSON.parse(stored)));
        }
      }
    };

    init();
  }, [userId, user?.id, getOrCreateConversation]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSendMessage = async (content: string, mediaUrl?: string, mediaType?: string) => {
    let finalContent = content;
    
    // Add reply prefix if replying
    if (replyTo) {
      const replyPreview = replyTo.content.length > 30 
        ? replyTo.content.substring(0, 30) + '...'
        : replyTo.content;
      finalContent = `↩️ "${replyPreview}"\n${content}`;
      setReplyTo(null);
    }

    await sendMessage(finalContent, mediaUrl, mediaType);
    setTyping(false);
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
    localStorage.setItem(`deleted_messages_${conversationId}`, JSON.stringify([...newDeleted]));
    toast.success('Xabar o\'chirildi');
  };

  const handleDeleteForAll = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
      toast.success('Xabar barcha uchun o\'chirildi');
      refetch();
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Xatolik yuz berdi');
    }
  };

  const formatMessageTime = (dateStr: string) => {
    return format(new Date(dateStr), 'HH:mm');
  };

  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Bugun";
    if (isYesterday(date)) return "Kecha";
    return format(date, 'd MMMM', { locale: uz });
  };

  const shouldShowDateSeparator = (currentMsg: Message, prevMsg: Message | undefined) => {
    if (!prevMsg) return true;
    return !isSameDay(new Date(currentMsg.created_at), new Date(prevMsg.created_at));
  };

  const getStatusIcon = (status: string, isMine: boolean) => {
    if (!isMine) return null;
    
    switch (status) {
      case 'sending':
        return <Clock className="h-3 w-3 text-muted-foreground animate-pulse" />;
      case 'sent':
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case 'seen':
        return <CheckCheck className="h-3 w-3 text-green-500" />;
      default:
        return null;
    }
  };

  const renderMessageContent = (msg: Message, isMine: boolean) => {
    // Voice message
    if (msg.media_type === 'audio' && msg.media_url) {
      return (
        <VoiceMessage 
          audioUrl={msg.media_url} 
          isMine={isMine}
        />
      );
    }

    // Image or video message
    if ((msg.media_type === 'image' || msg.media_type === 'video') && msg.media_url) {
      return (
        <div className="space-y-2">
          <MediaMessage
            mediaUrl={msg.media_url}
            mediaType={msg.media_type}
            isMine={isMine}
            onFullscreen={() => setFullscreenMedia({ url: msg.media_url!, type: msg.media_type as 'image' | 'video' })}
          />
          {msg.content && msg.content !== '📎 Media' && (
            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
          )}
        </div>
      );
    }

    // Text message
    return (
      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
    );
  };

  // Filter out deleted messages
  const visibleMessages = messages.filter(m => !deletedMessageIds.has(m.id));

  if (!otherUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <>
      {/* Fullscreen media viewer */}
      {fullscreenMedia && (
        <MediaFullscreen
          mediaUrl={fullscreenMedia.url}
          mediaType={fullscreenMedia.type}
          onClose={() => setFullscreenMedia(null)}
        />
      )}

      {/* Video Call UI */}
      {isInCall && callObject && (
        <VideoCallUI
          callObject={callObject}
          remoteParticipant={remoteParticipant}
          cameraOn={cameraOn}
          micOn={micOn}
          onToggleCamera={toggleCamera}
          onToggleMic={toggleMic}
          onEndCall={leaveCall}
        />
      )}

      {/* Incoming Call Dialog */}
      {incomingCall && (
        <IncomingCallDialog
          callerId={incomingCall.caller_id}
          onAnswer={answerCall}
          onDecline={declineCall}
        />
      )}

      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/messages')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar 
              className="h-10 w-10 cursor-pointer" 
              onClick={() => navigate(`/user/${userId}`)}
            >
              <AvatarImage src={otherUser.avatar_url || undefined} />
              <AvatarFallback>{getInitials(otherUser.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1" onClick={() => navigate(`/user/${userId}`)}>
              <h1 className="font-semibold">{otherUser.name || 'Foydalanuvchi'}</h1>
              {otherUserTyping ? (
                <p className="text-xs text-primary">yozyapti...</p>
              ) : (
                <p className="text-xs text-muted-foreground">oxirgi faollik</p>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={startCall}
              disabled={isCreatingRoom || isInCall}
            >
              {isCreatingRoom ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Video className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ 
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Yuklanmoqda...</p>
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Avatar className="h-20 w-20 mx-auto mb-4">
                  <AvatarImage src={otherUser.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl">{getInitials(otherUser.name)}</AvatarFallback>
                </Avatar>
                <h3 className="font-semibold">{otherUser.name || 'Foydalanuvchi'}</h3>
                <p className="text-sm text-muted-foreground">@{otherUser.username || 'username'}</p>
                <p className="text-sm text-muted-foreground mt-4">Suhbatni boshlang!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleMessages.map((msg, index) => {
                const isMine = msg.sender_id === user?.id;
                const prevMsg = visibleMessages[index - 1];
                const showDateSeparator = shouldShowDateSeparator(msg, prevMsg);

                return (
                  <div key={msg.id}>
                    {showDateSeparator && (
                      <div className="flex justify-center my-4">
                        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                          {formatDateSeparator(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <div className={cn(
                      "flex",
                      isMine ? "justify-end" : "justify-start"
                    )}>
                      <MessageContextMenu
                        messageContent={msg.content}
                        messageId={msg.id}
                        isMine={isMine}
                        isPrivateChat={true}
                        onReply={handleReply}
                        onForward={handleForward}
                        onDeleteForMe={handleDeleteForMe}
                        onDeleteForAll={isMine ? handleDeleteForAll : undefined}
                      >
                        <div className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-2",
                          isMine 
                            ? "bg-primary text-primary-foreground rounded-br-md" 
                            : "bg-muted rounded-bl-md"
                        )}>
                          {renderMessageContent(msg, isMine)}
                          <div className={cn(
                            "flex items-center gap-1 mt-1",
                            isMine ? "justify-end" : "justify-start"
                          )}>
                            <span className={cn(
                              "text-xs",
                              isMine ? "text-primary-foreground/70" : "text-muted-foreground"
                            )}>
                              {formatMessageTime(msg.created_at)}
                            </span>
                            {getStatusIcon(msg.status, isMine)}
                          </div>
                        </div>
                      </MessageContextMenu>
                    </div>
                  </div>
                );
              })}
              
              {/* Typing indicator */}
              {otherUserTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Reply Preview */}
        {replyTo && (
          <ReplyPreview
            replyToContent={replyTo.content}
            onCancel={() => setReplyTo(null)}
          />
        )}

        {/* Chat Input */}
        <ChatInput
          conversationId={conversationId}
          onSendMessage={handleSendMessage}
          onTyping={setTyping}
        />
      </div>

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
    </>
  );
};

export default Chat;
