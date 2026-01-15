"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// import { ScrollArea } from "@/components/ui/scroll-area"; // TODO: Add shadcn ScrollArea component
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Loader2, Plus, Trash2 } from "lucide-react";
import {
  createNewConversation,
  sendMessage,
  ChatMessage,
  getConversationHistory,
  deleteConversation,
} from "@/lib/api/ai-chat";
import { useToast } from "@/hooks/use-toast";
// import ReactMarkdown from "react-markdown"; // TODO: Install react-markdown

interface Message extends ChatMessage {
  id: string;
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Auto-create first conversation
    if (!conversationId) {
      handleNewConversation();
    }
  }, []);

  const handleNewConversation = async () => {
    try {
      const response = await createNewConversation();
      setConversationId(response.conversation_id);
      setMessages([]);
      setConversations((prev) => [response.conversation_id, ...prev]);
      toast({
        title: "New conversation started",
        description: "You can now chat with the AI assistant",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create conversation",
        variant: "destructive",
      });
    }
  };

  const handleLoadConversation = async (convId: string) => {
    try {
      setIsLoading(true);
      const history = await getConversationHistory(convId);
      setConversationId(convId);
      setMessages(
        history.messages.map((msg, idx) => ({
          ...msg,
          id: `${convId}-${idx}`,
        }))
      );
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to load conversation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConversation = async (convId: string) => {
    try {
      await deleteConversation(convId);
      setConversations((prev) => prev.filter((id) => id !== convId));
      if (conversationId === convId) {
        handleNewConversation();
      }
      toast({
        title: "Conversation deleted",
        description: "The conversation has been removed",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete conversation",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !conversationId) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await sendMessage({
        conversation_id: conversationId,
        message: userMessage.content,
      });

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.message,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Show tools used if any
      if (response.tools_used && response.tools_used.length > 0) {
        toast({
          title: "Data accessed",
          description: `Used: ${response.tools_used.join(", ")}`,
        });
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content:
          error instanceof Error
            ? error.message
            : "Sorry, something went wrong. Please try again.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);

      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-120px)]">
        {/* Sidebar with conversations */}
        <div className="col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Conversations</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleNewConversation}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>Your chat history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[calc(100vh-280px)] overflow-y-auto">
                <div className="space-y-2">
                  {conversations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No conversations yet
                    </p>
                  ) : (
                    conversations.map((convId) => (
                      <div
                        key={convId}
                        className={`flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer ${
                          conversationId === convId ? "bg-accent" : ""
                        }`}
                      >
                        <button
                          onClick={() => handleLoadConversation(convId)}
                          className="flex-1 text-left text-sm truncate"
                        >
                          {convId.substring(0, 8)}...
                        </button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConversation(convId);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main chat area */}
        <div className="col-span-9">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle>AI Assistant</CardTitle>
                  <CardDescription>
                    Ask questions about products, customers, orders, and quotes
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto pr-4">
                <div className="space-y-4 pb-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12">
                      <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">
                        Start a conversation
                      </p>
                      <p className="text-sm mt-2">
                        Ask me about your ERP data or request assistance
                      </p>
                      <div className="mt-6 grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                        <Button
                          variant="outline"
                          onClick={() =>
                            setInput("Show me all products in stock")
                          }
                        >
                          View products
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setInput("List recent orders")
                          }
                        >
                          Check orders
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setInput("Find customer information")
                          }
                        >
                          Find customers
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setInput("Show pending quotes")
                          }
                        >
                          View quotes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(message.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input area */}
              <div className="border-t pt-4 mt-4">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Ask me anything about your ERP data..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading || !conversationId}
                    rows={2}
                    className="resize-none"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={isLoading || !input.trim() || !conversationId}
                    size="icon"
                    className="shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
