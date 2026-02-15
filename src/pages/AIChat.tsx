import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Wand2, Mic, Bot, Sparkles } from 'lucide-react';
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

const AIChat = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AITab>('chat');
  const [messages, setMessages] = useState<AIChatMessage[]>([]);

  const tabs: { id: AITab; label: string; icon: React.ReactNode }[] = [
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { id: 'image', label: 'Studio', icon: <Wand2 className="h-3.5 w-3.5" /> },
    { id: 'voice', label: 'Voice', icon: <Mic className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border/30 bg-background/60 backdrop-blur-2xl">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/messages')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="relative">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Bot className="h-4.5 w-4.5 text-white" />
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
        </div>

        {/* Tab Bar */}
        <div className="flex justify-center px-4 pb-2">
          <div className="bg-card/50 backdrop-blur-xl p-1 rounded-full flex items-center border border-border/30 max-w-[260px] w-full justify-between">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300',
                  activeTab === tab.id
                    ? 'bg-foreground text-background shadow-md'
                    : 'text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100'
                )}>
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 flex flex-col relative z-0 overflow-hidden">
        {activeTab === 'chat' && <AIChatView messages={messages} setMessages={setMessages} />}
        {activeTab === 'image' && <AIImageView />}
        {activeTab === 'voice' && <AIVoiceView />}
      </main>

      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-20%] w-[70vw] h-[70vw] blur-[100px] rounded-full bg-primary/5 animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute bottom-[-10%] right-[-20%] w-[70vw] h-[70vw] blur-[100px] rounded-full bg-purple-500/5 animate-pulse" style={{ animationDuration: '7s' }} />
      </div>
    </div>
  );
};

export default AIChat;
