'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  Send,
  Bot,
  User,
  CheckCircle2,
  Package,
  DollarSign,
  ShoppingCart,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: QuickAction[];
  quoteData?: QuotePreview;
}

interface QuickAction {
  label: string;
  action: string;
  icon?: string;
}

interface QuotePreview {
  customer?: string;
  products: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  ready: boolean;
}

interface QuoteCopilotChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuoteCreated?: (quoteData: Record<string, unknown>) => void;
  initialMessage?: string;
}

/**
 * PHASE C: Quote Copilot Chat
 *
 * Conversational AI assistant for quote creation. Guides users through
 * the quote process by asking questions, suggesting products, and building
 * quotes interactively through natural dialogue.
 *
 * @example
 * <QuoteCopilotChat
 *   open={copilotOpen}
 *   onOpenChange={setCopilotOpen}
 *   onQuoteCreated={(data) => handleQuoteCreation(data)}
 * />
 */
export function QuoteCopilotChat({
  open,
  onOpenChange,
  onQuoteCreated,
  initialMessage,
}: QuoteCopilotChatProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(() => `quote-copilot-${Date.now()}`);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);

      // Send initial greeting if no messages yet
      if (messages.length === 0) {
        const greeting: Message = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content:
            initialMessage ||
            "Hi! I'm your Quote Copilot. I'll help you create a quote by asking a few questions. Let's start: **Who is this quote for?** You can tell me the customer name or company.",
          timestamp: new Date(),
          suggestions: [
            { label: 'List Customers', action: 'list_customers' },
            { label: 'New Customer', action: 'new_customer' },
          ],
        };
        setMessages([greeting]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text) return;

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      // Send to copilot endpoint
      const response = await apiClient.post<{
        message: string;
        suggestions?: QuickAction[];
        quote_preview?: QuotePreview;
        action?: string;
      }>('/api/ai/copilot/quote', {
        session_id: sessionId,
        message: text,
        context: {
          conversation_history: messages.slice(-5), // Last 5 messages for context
        },
      });

      // Add assistant response
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        suggestions: response.suggestions,
        quoteData: response.quote_preview,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Handle special actions
      if (response.action === 'create_quote' && response.quote_preview?.ready) {
        // Quote is ready to be created
        setTimeout(() => {
          toast({
            title: 'Quote Ready',
            description: "Your quote is ready! Click 'Create Quote' to finalize.",
          });
        }, 500);
      }
    } catch (error: unknown) {
      console.error('Failed to send message:', error);

      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: "I'm having trouble processing that. Could you rephrase or try again?",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);

      toast({
        title: 'Communication Error',
        description:
          error instanceof Error ? error.message : 'Failed to communicate with Quote Copilot.',
        variant: 'destructive',
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickAction = (action: string) => {
    // Handle predefined actions
    const actionMessages: Record<string, string> = {
      list_customers: 'Show me the customer list',
      new_customer: 'I need to create a quote for a new customer',
      add_products: 'I want to add products to this quote',
      review_quote: 'Let me review the quote details',
      create_quote: 'Create the quote now',
    };

    const message = actionMessages[action] || action;
    sendMessage(message);
  };

  const handleCreateQuote = () => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.quoteData && onQuoteCreated) {
      onQuoteCreated(lastMessage.quoteData as unknown as Record<string, unknown>);
      onOpenChange(false);
      setMessages([]);
      toast({
        title: 'Quote Created',
        description: 'Quote has been created from the conversation.',
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[600px] max-w-2xl flex-col p-0">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <div className="bg-gradient-brand/10 rounded-lg border border-white/10 p-2">
              <Sparkles className="text-brand-primary h-5 w-5" />
            </div>
            Quote Copilot
          </DialogTitle>
          <DialogDescription>
            Interactive AI assistant to help you create quotes through conversation
          </DialogDescription>
        </DialogHeader>

        {/* Chat Messages */}
        <ScrollArea className="flex-1 px-6 py-4" ref={scrollRef}>
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0">
                      <div className="bg-gradient-brand/10 rounded-full border border-white/10 p-2">
                        <Bot className="text-brand-primary h-4 w-4" />
                      </div>
                    </div>
                  )}

                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg p-4',
                      message.role === 'user'
                        ? 'bg-brand-primary text-primary-foreground'
                        : 'bg-muted/50 border border-white/10'
                    )}
                  >
                    <div
                      className={cn(
                        'text-sm whitespace-pre-wrap',
                        message.role === 'user' ? 'text-primary-foreground' : 'text-foreground'
                      )}
                      dangerouslySetInnerHTML={{
                        __html: message.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
                      }}
                    />

                    {/* Quote Preview */}
                    {message.quoteData && (
                      <div className="bg-card/50 mt-3 space-y-2 rounded-lg border border-white/10 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <ShoppingCart className="h-3 w-3" />
                          Quote Preview
                        </div>
                        {message.quoteData.customer && (
                          <p className="text-muted-foreground text-xs">
                            Customer: {message.quoteData.customer}
                          </p>
                        )}
                        <div className="space-y-1">
                          {message.quoteData.products.map((product, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span>
                                {product.quantity}x {product.name}
                              </span>
                              <span className="font-medium">${product.price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between border-t border-white/10 pt-2">
                          <span className="text-xs font-semibold">Total</span>
                          <span className="text-brand-primary text-sm font-bold">
                            ${message.quoteData.total.toFixed(2)}
                          </span>
                        </div>
                        {message.quoteData.ready && (
                          <Button size="sm" onClick={handleCreateQuote} className="mt-2 w-full">
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Create This Quote
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Quick Actions */}
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.suggestions.map((suggestion, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickAction(suggestion.action)}
                            className="h-7 text-xs"
                          >
                            {suggestion.label}
                          </Button>
                        ))}
                      </div>
                    )}

                    <p className="text-muted-foreground mt-2 text-xs opacity-50">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {message.role === 'user' && (
                    <div className="flex-shrink-0">
                      <div className="bg-brand-primary/10 border-brand-primary/20 rounded-full border p-2">
                        <User className="text-brand-primary h-4 w-4" />
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing Indicator */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="flex-shrink-0">
                  <div className="bg-gradient-brand/10 rounded-full border border-white/10 p-2">
                    <Bot className="text-brand-primary h-4 w-4" />
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg border border-white/10 p-4">
                  <div className="flex gap-1">
                    <div
                      className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="bg-muted/30 border-t px-6 py-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isTyping}
              className="flex-1"
            />
            <Button onClick={() => sendMessage()} disabled={!input.trim() || isTyping} size="icon">
              {isTyping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
