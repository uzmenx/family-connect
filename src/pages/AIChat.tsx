import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Wand2, Mic, Sparkles, Menu, SquarePen, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import AIChatView from '@/components/ai/AIChatView';
import AIImageView from '@/components/ai/AIImageView';
import AIVoiceView from '@/components/ai/AIVoiceView';

type AITab = 'chat' | 'image' | 'voice';

interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
  attachments?: { type: string; data: string; name: string }[];
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: AIChatMessage[];
}

const STORAGE_KEY = 'ai_chat_sessions_v1';

const newId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const serializeSessions = (sessions: ChatSession[]) => {
  return sessions.map((s) => ({
    ...s,
    messages: s.messages.map((m) => ({
      ...m,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : (m.timestamp as any),
    })),
  }));
};

const deserializeSessions = (raw: unknown): ChatSession[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s: any) => {
      const msgs = Array.isArray(s?.messages) ? s.messages : [];
      return {
        id: typeof s?.id === 'string' ? s.id : newId(),
        title: typeof s?.title === 'string' ? s.title : 'New Chat',
        updatedAt: typeof s?.updatedAt === 'number' ? s.updatedAt : Date.now(),
        messages: msgs.map((m: any) => ({
          id: typeof m?.id === 'string' ? m.id : newId(),
          role: m?.role === 'assistant' ? 'assistant' : 'user',
          content: typeof m?.content === 'string' ? m.content : '',
          timestamp: m?.timestamp ? new Date(m.timestamp) : new Date(),
          model: typeof m?.model === 'string' ? m.model : undefined,
          attachments: Array.isArray(m?.attachments) ? m.attachments : undefined,
        })),
      } as ChatSession;
    })
    .filter(Boolean);
};

const AIChat = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AITab>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      const loaded = deserializeSessions(parsed);
      if (loaded.length > 0) {
        setSessions(loaded);
        setActiveSessionId((prev) => prev || loaded[0].id);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeSessions(sessions)));
    } catch {
      // ignore
    }
  }, [sessions]);

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  const ensureSession = () => {
    if (activeSession) return activeSession;
    const s: ChatSession = { id: newId(), title: 'New Chat', updatedAt: Date.now(), messages: [] };
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(s.id);
    return s;
  };

  const createNewChat = () => {
    const s: ChatSession = { id: newId(), title: 'New Chat', updatedAt: Date.now(), messages: [] };
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(s.id);
    setActiveTab('chat');
    setSidebarOpen(false);
  };

  const setMessagesForActive = (updater: React.SetStateAction<AIChatMessage[]>) => {
    const s = ensureSession();
    setSessions((prev) =>
      prev.map((sess) => {
        if (sess.id !== s.id) return sess;
        const nextMessages = typeof updater === 'function' ? (updater as any)(sess.messages) : updater;

        let title = sess.title;
        if (!title || title === 'New Chat') {
          const firstUser = nextMessages.find((m: AIChatMessage) => m.role === 'user' && m.content?.trim());
          if (firstUser?.content) title = firstUser.content.trim().slice(0, 32);
        }

        return {
          ...sess,
          title,
          messages: nextMessages,
          updatedAt: Date.now(),
        };
      })
    );
  };

  const tabs: { id: AITab; label: string; icon: React.ReactNode }[] = [
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { id: 'image', label: 'Studio', icon: <Wand2 className="h-3.5 w-3.5" /> },
    { id: 'voice', label: 'Voice', icon: <Mic className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-background/30 backdrop-blur-2xl">
        <div className="px-4 py-3 flex items-center gap-3">
          <motion.button
            type="button"
            onClick={() => navigate('/messages')}
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.03 }}
            className="h-10 w-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center shadow-[0_10px_30px_-20px_rgba(0,0,0,0.7)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div className="relative">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 p-[1.5px] shadow-lg shadow-purple-500/30">
              <img
                src="/ai-avatar.png"
                alt="AI"
                className="h-full w-full rounded-full object-cover bg-background"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/favicon.ico';
                }}
              />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
          </div>
          <div className="flex-1">
            <h1 className="font-bold text-foreground text-sm">AI Do'stim</h1>
            <div className="flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5 text-purple-400" />
              <span className="text-[10px] text-purple-400">Doim online</span>
            </div>
          </div>
          <motion.button
            type="button"
            onClick={createNewChat}
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.03 }}
            className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500/30 via-purple-500/25 to-pink-500/30 hover:from-indigo-500/40 hover:to-pink-500/40 border border-white/10 flex items-center justify-center shadow-[0_16px_40px_-24px_rgba(168,85,247,0.9)]"
          >
            <SquarePen className="h-5 w-5" />
          </motion.button>
        </div>

        {/* Tab Bar */}
        <div className="flex justify-center px-4 pb-2">
          <div className="max-w-[360px] w-full flex items-center gap-2">
            <motion.button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.03 }}
              className="h-10 w-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center shadow-[0_10px_30px_-20px_rgba(0,0,0,0.7)]"
              aria-label="History"
              title="History"
            >
              <Menu className="h-5 w-5" />
            </motion.button>

            <div className="flex-1 bg-white/5 backdrop-blur-2xl p-1 rounded-full flex items-center border border-white/10 justify-between shadow-[0_18px_40px_-28px_rgba(0,0,0,0.7)]">
              {tabs.map((tab) => (
                <motion.button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  whileTap={{ scale: 0.97 }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all duration-300',
                    activeTab === tab.id
                      ? 'bg-foreground text-background shadow-md'
                      : 'text-muted-foreground hover:text-foreground opacity-80 hover:opacity-100'
                  )}
                >
                  <motion.span
                    animate={activeTab === tab.id ? { rotate: [0, -8, 0], scale: [1, 1.05, 1] } : { rotate: 0, scale: 1 }}
                    transition={{ duration: 0.35 }}
                    className="inline-flex"
                  >
                    {tab.icon}
                  </motion.span>
                  {tab.label}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex relative z-0 overflow-hidden">
        {/* Sidebar */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 z-50 w-[290px] max-w-[84vw] bg-background/70 backdrop-blur-2xl border-r border-white/10 transition-transform duration-300 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_30px_90px_-60px_rgba(0,0,0,0.9)]',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="p-4 flex items-center justify-between">
            <div className="font-bold text-foreground">Gemini Nexus</div>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="px-4">
            <button
              onClick={createNewChat}
              className="w-full flex items-center gap-2 px-3 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors font-semibold"
            >
              <span className="inline-flex w-6 h-6 rounded-full bg-background/40 items-center justify-center">+</span>
              New Chat
            </button>
          </div>
          <div className="px-4 pt-5 text-[11px] font-bold tracking-wider text-muted-foreground">RECENT</div>
          <div className="p-3 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 210px)' }}>
            {(sessions
              .slice()
              .sort((a, b) => b.updatedAt - a.updatedAt)
            ).map((s) => {
              const isActive = s.id === activeSessionId;
              const lastAssistant = [...s.messages].reverse().find((m) => m.role === 'assistant');
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSessionId(s.id);
                    setActiveTab('chat');
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    'w-full text-left p-3 rounded-2xl border transition-colors',
                    isActive ? 'bg-card/60 border-border/60' : 'bg-card/20 border-border/30 hover:bg-card/40'
                  )}
                >
                  <div className="font-semibold text-foreground truncate">{s.title || 'New Chat'}</div>
                  <div className="text-xs text-muted-foreground truncate mt-1">
                    {lastAssistant?.content || '...'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {sidebarOpen && (
          <button
            className="absolute inset-0 z-40 bg-black/40"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
        )}

        {/* Main */}
        <main className="flex-1 flex flex-col relative z-0 overflow-hidden">
          {activeTab === 'chat' && (
            <AIChatView
              messages={activeSession?.messages || []}
              setMessages={setMessagesForActive}
            />
          )}
          {activeTab === 'image' && <AIImageView />}
          {activeTab === 'voice' && <AIVoiceView />}
        </main>
      </div>

      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-20%] w-[70vw] h-[70vw] blur-[100px] rounded-full bg-primary/5 animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute bottom-[-10%] right-[-20%] w-[70vw] h-[70vw] blur-[100px] rounded-full bg-purple-500/5 animate-pulse" style={{ animationDuration: '7s' }} />
      </div>
    </div>
  );
};

export default AIChat;
