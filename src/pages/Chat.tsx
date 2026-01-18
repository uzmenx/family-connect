import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/hooks/useMessages';
import { useConversations } from '@/hooks/useConversations';
import { useVideoCall } from '@/hooks/useVideoCall';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Check, CheckCheck, Video, Loader2 } from 'lucide-react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { uz } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { VideoCallUI } from '@/components/chat/VideoCallUI';
import { IncomingCallDialog } from '@/components/chat/IncomingCallDialog';

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
  const [inputValue, setInputValue] = useState('');
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, otherUserTyping, sendMessage, setTyping } = useMessages(conversationId);
  
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

  // Initialize conversation
  useEffect(() => {
    const init = async () => {
      if (!userId || !user?.id) return;

      // Get or create conversation
      const convId = await getOrCreateConversation(userId);
      setConversationId(convId);

      // Get other user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .eq('id', userId)
        .maybeSingle();

      setOtherUser(profile);
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

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    await sendMessage(inputValue);
    setInputValue('');
    setTyping(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setTyping(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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

  const shouldShowDateSeparator = (currentMsg: any, prevMsg: any) => {
    if (!prevMsg) return true;
    return !isSameDay(new Date(currentMsg.created_at), new Date(prevMsg.created_at));
  };

  const getStatusIcon = (status: string, isMine: boolean) => {
    if (!isMine) return null;
    
    switch (status) {
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

  // Rubber band effect
  const [overscrollY, setOverscrollY] = useState(0);
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;
    
    if (scrollTop + clientHeight >= scrollHeight) {
      setOverscrollY(0);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    
    if (scrollTop + clientHeight >= scrollHeight) {
      const touch = e.touches[0];
      const startY = touch.clientY;
      // Rubber band effect at bottom
    }
  }, []);

  if (!otherUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <>
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
        onScroll={handleScroll}
        onTouchMove={handleTouchMove}
        style={{ 
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Yuklanmoqda...</p>
          </div>
        ) : messages.length === 0 ? (
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
            {messages.map((msg, index) => {
              const isMine = msg.sender_id === user?.id;
              const prevMsg = messages[index - 1];
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
                    <div className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2",
                      isMine 
                        ? "bg-primary text-primary-foreground rounded-br-md" 
                        : "bg-muted rounded-bl-md"
                    )}>
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
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

        {/* Rubber band effect indicator at bottom */}
        <div 
          className="h-20 flex items-center justify-center text-muted-foreground/50 transition-opacity"
          style={{ opacity: overscrollY > 0 ? 1 : 0 }}
        >
          <p className="text-sm">Xabarlar tugadi</p>
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-background border-t border-border p-4 safe-area-bottom">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Xabar yozing..."
            className="flex-1"
          />
          <Button 
            size="icon" 
            onClick={handleSend}
            disabled={!inputValue.trim()}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
        </div>
      </div>
    </>
  );
};

export default Chat;
