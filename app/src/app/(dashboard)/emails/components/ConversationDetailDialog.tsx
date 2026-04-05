"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  getConversation,
  getStatusColor,
  getIntentColor,
  formatIntent,
  type EmailMessage,
  type EmailConversation,
} from "@/lib/api/sendgrid";
import { Mail, Bot, User, ArrowDown, ArrowUp } from "lucide-react";

interface ConversationDetailDialogProps {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ConversationDetailDialog({
  conversationId,
  open,
  onOpenChange,
  onSuccess,
}: ConversationDetailDialogProps) {
  const { toast } = useToast();
  const [conversation, setConversation] = useState<EmailConversation | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversation = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getConversation(conversationId);
      setConversation(response.conversation);
      setMessages(response.messages);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load conversation";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  }, [conversationId, toast]);

  useEffect(() => {
    if (open && conversationId) {
      loadConversation();
    }
  }, [conversationId, open, loadConversation]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        {loading ? (
          <>
            <DialogHeader>
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </DialogHeader>
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </>
        ) : conversation ? (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <DialogTitle>{conversation.subject}</DialogTitle>
                    <Badge variant={getStatusColor(conversation.status)}>
                      {conversation.status}
                    </Badge>
                    {conversation.intent && (
                      <Badge variant={getIntentColor(conversation.intent)}>
                        {formatIntent(conversation.intent)}
                      </Badge>
                    )}
                  </div>
                  <DialogDescription>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{conversation.customer_email}</span>
                        {conversation.customer_name && (
                          <span className="text-muted-foreground">
                            ({conversation.customer_name})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {conversation.message_count} messages •{" "}
                        {format(new Date(conversation.first_message_at), "PPp")}
                      </div>
                    </div>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <Separator />

            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <Card
                    key={message.id}
                    className={
                      message.direction === "inbound"
                        ? "bg-muted/50"
                        : message.was_ai_generated
                        ? "bg-blue-50 dark:bg-blue-950"
                        : "bg-primary/5"
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${
                              message.direction === "inbound"
                                ? "bg-muted"
                                : message.was_ai_generated
                                ? "bg-blue-500/10"
                                : "bg-primary/10"
                            }`}
                          >
                            {message.direction === "inbound" ? (
                              <User className="h-4 w-4" />
                            ) : message.was_ai_generated ? (
                              <Bot className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Mail className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">
                                {message.direction === "inbound" ? "Customer" : "You"}
                              </p>
                              {message.direction === "inbound" ? (
                                <ArrowDown className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <ArrowUp className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {message.from_email}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(message.sent_at), "PPp")}
                          </p>
                          {message.was_ai_generated && (
                            <Badge variant="secondary" className="mt-1 text-xs">
                              AI Generated
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="text-sm whitespace-pre-wrap">{message.body_text}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
