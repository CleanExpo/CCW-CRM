'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { copilotApi, type CopilotMessage, type CopilotQueryResponse } from '@/lib/api/copilot';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggested_actions?: string[];
  sources?: string[];
  demo_mode?: boolean;
  timestamp: Date;
}

interface StaffCopilotWidgetProps {
  moduleContext?: 'orders' | 'products' | 'customers' | 'inventory' | 'general';
  entityId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StaffCopilotWidget({
  moduleContext = 'general',
  entityId,
}: StaffCopilotWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<CopilotMessage[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Add welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content:
            "Hi! I'm your Staff Copilot. Ask me about orders, customers, inventory, or anything operational.",
          suggested_actions: [
            'What needs attention today?',
            'Show overdue orders',
            'List pending approvals',
          ],
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);

      // Build updated history for multi-turn context
      const newHistory: CopilotMessage[] = [
        ...conversationHistory,
        { role: 'user', content: trimmed },
      ];

      try {
        const result: CopilotQueryResponse = await copilotApi.query({
          query: trimmed,
          module_context: moduleContext,
          entity_id: entityId,
          conversation_history: newHistory,
        });

        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: result.answer,
          suggested_actions: result.suggested_actions,
          sources: result.sources,
          demo_mode: result.demo_mode,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setConversationHistory([...newHistory, { role: 'assistant', content: result.answer }]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: 'Sorry, I was unable to process your request. Please try again.',
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, conversationHistory, moduleContext, entityId]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <div className="fixed right-6 bottom-6 z-[60]">
        {!isOpen && (
          <Button
            onClick={() => setIsOpen(true)}
            size="sm"
            className="flex h-10 items-center gap-2 rounded-full px-4 py-2 shadow-lg"
          >
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Copilot</span>
          </Button>
        )}
      </div>

      {/* Chat panel */}
      {isOpen && (
        <div className="bg-background fixed right-6 bottom-6 z-[60] flex max-h-[580px] w-[380px] flex-col overflow-hidden rounded-xl border shadow-2xl">
          {/* Header */}
          <div className="bg-primary text-primary-foreground flex items-center justify-between rounded-t-xl border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-semibold">Staff Copilot</span>
              {moduleContext !== 'general' && (
                <Badge
                  variant="secondary"
                  className="bg-primary-foreground/20 text-primary-foreground border-none px-1.5 py-0 text-[10px]"
                >
                  {moduleContext}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/20 h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea
            className="flex-1 px-4 py-3"
            ref={scrollRef as React.RefObject<HTMLDivElement>}
          >
            <div className="flex flex-col gap-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex flex-col gap-1',
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    {msg.content}
                  </div>

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex max-w-[85%] flex-wrap gap-1">
                      {msg.sources.map((src) => (
                        <span
                          key={src}
                          className="text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5 text-[10px]"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Suggested actions */}
                  {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                    <div className="flex max-w-[85%] flex-wrap gap-1">
                      {msg.suggested_actions.map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => sendMessage(action)}
                          className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 cursor-pointer rounded-full border px-2.5 py-1 text-[11px] transition-colors"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Demo mode badge */}
                  {msg.demo_mode && msg.role === 'assistant' && (
                    <span className="text-muted-foreground text-[10px] italic">Demo mode</span>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex items-start">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <div className="flex h-4 items-center gap-1">
                      <span className="bg-muted-foreground h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]" />
                      <span className="bg-muted-foreground h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
                      <span className="bg-muted-foreground h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="flex items-center gap-2 border-t px-3 py-3">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              className="h-9 flex-1 text-sm"
              disabled={isLoading}
            />
            <Button
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
