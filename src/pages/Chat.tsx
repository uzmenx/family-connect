import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
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
  updated_at: string | null;
}

const Chat = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
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
        .select('id, name, username, avatar_url, updated_at')
        .eq('id', userId)
        .maybeSingle();

      setOtherUser(profile as UserProfile | null);

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
    toast.success(t('msgDeleted'));
  };

  const handleDeleteForAll = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
      toast.success(t('msgDeletedAll'));
      refetch();
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error(t('errorOccurred'));
    }
  };

  const formatMessageTime = (dateStr: string) => {
    return format(new Date(dateStr), 'HH:mm');
  };

  const formatLastActivity = (dateStr: string | null | undefined) => {
    if (!dateStr) return t('lastActivity');
    const date = new Date(dateStr);
    if (isToday(date)) return `${t('today')} ${format(date, 'HH:mm')} da`;
    if (isYesterday(date)) return `${t('yesterday')} ${format(date, 'HH:mm')} da`;
    return format(date, 'd MMMM HH:mm', { locale: uz }) + ' da';
  };

  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return t('today');
    if (isYesterday(date)) return t('yesterday');
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
        return <CheckCheck className="h-3 w-3 text-primary" />;
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
        <p className="text-muted-foreground">{t('loading')}</p>
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
        {/* Header - glassmorphism */}
        <div className="sticky top-0 z-40 bg-background/70 backdrop-blur-xl border-b border-border/20 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/messages')} className="p-1.5 rounded-full hover:bg-muted/50 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Avatar 
              className="h-9 w-9 cursor-pointer ring-2 ring-primary/20" 
              onClick={() => navigate(`/user/${userId}`)}
            >
              <AvatarImage src={otherUser.avatar_url || undefined} />
              <AvatarFallback className="text-xs">{getInitials(otherUser.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0" onClick={() => navigate(`/user/${userId}`)}>
              <h1 className="font-semibold text-sm truncate">{otherUser.name || t('user')}</h1>
              {otherUserTyping ? (
                <p className="text-[11px] text-primary font-medium">{t('typing')}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">{formatLastActivity(otherUser.updated_at)}</p>
              )}
            </div>
            <button 
              onClick={startCall}
              disabled={isCreatingRoom || isInCall}
              className="p-2 rounded-full hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              {isCreatingRoom ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Video className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-y-auto px-3 py-3"
          style={{ 
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-sm">{t('loading')}</p>
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Avatar className="h-16 w-16 mx-auto mb-3 ring-2 ring-primary/20">
                  <AvatarImage src={otherUser.avatar_url || undefined} />
                  <AvatarFallback className="text-xl">{getInitials(otherUser.name)}</AvatarFallback>
                </Avatar>
                <h3 className="font-semibold text-sm">{otherUser.name || t('user')}</h3>
                <p className="text-xs text-muted-foreground">@{otherUser.username || 'username'}</p>
                <p className="text-xs text-muted-foreground mt-3">{t('startChat')}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {visibleMessages.map((msg, index) => {
                const isMine = msg.sender_id === user?.id;
                const prevMsg = visibleMessages[index - 1];
                const showDateSeparator = shouldShowDateSeparator(msg, prevMsg);

                return (
                  <div key={msg.id}>
                    {showDateSeparator && (
                      <div className="flex justify-center my-3">
                        <span className="text-[10px] text-muted-foreground bg-muted/60 backdrop-blur-sm px-3 py-0.5 rounded-full">
                          {formatDateSeparator(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
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
                          "max-w-[78%] rounded-2xl px-3.5 py-2",
                          isMine 
                            ? "bg-primary text-primary-foreground rounded-br-md" 
                            : "bg-muted/70 backdrop-blur-sm rounded-bl-md"
                        )}>
                          {renderMessageContent(msg, isMine)}
                          <div className={cn(
                            "flex items-center gap-1 mt-0.5",
                            isMine ? "justify-end" : "justify-start"
                          )}>
                            <span className={cn(
                              "text-[10px]",
                              isMine ? "text-primary-foreground/60" : "text-muted-foreground"
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
                  <div className="bg-muted/70 backdrop-blur-sm rounded-2xl rounded-bl-md px-4 py-2.5">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
