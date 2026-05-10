"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, RefreshCw, Bot, Send, AlertCircle, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  listConversations,
  simulateInboundEmail,
  getStatusColor,
  getIntentColor,
  formatIntent,
  type EmailConversation,
} from "@/lib/api/sendgrid";
import { formatDistanceToNow } from "date-fns";
import { EmailComposeDialog } from "./components/EmailComposeDialog";
import { ConversationDetailDialog } from "./components/ConversationDetailDialog";

export default function EmailsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [conversations, setConversations] = useState<EmailConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [simulatingEmail, setSimulatingEmail] = useState(false);

  const loadConversations = useCallback(async (status?: string) => {
    try {
      const response = await listConversations(status === "all" ? undefined : status);
      setConversations(response.conversations);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load conversations";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadConversations(statusFilter);
  };

  const handleSimulateEmail = async () => {
    setSimulatingEmail(true);
    try {
      const result = await simulateInboundEmail(Math.floor(Math.random() * 5) + 1);
      toast({
        title: "Demo Email Simulated",
        description: `Processed email: ${result.preview.subject}`,
      });
      await loadConversations(statusFilter);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to simulate email";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setSimulatingEmail(false);
    }
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setLoading(true);
    loadConversations(value === "all" ? undefined : value);
  };

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Email Management</h1>
            <p className="text-sm text-muted-foreground">
              View and manage customer email conversations
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSimulateEmail} disabled={simulatingEmail}>
            <Bot className="mr-2 h-4 w-4" />
            {simulatingEmail ? "Simulating..." : "Simulate Demo Email"}
          </Button>
          <Button onClick={() => setComposeOpen(true)}>
            <Send className="mr-2 h-4 w-4" />
            Compose Email
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="responded">Responded</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Conversations List */}
      <div className="space-y-3">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : conversations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No conversations yet</h3>
              <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
                Outbound mail sent from Compose is delivered via SendGrid and saved here. For demo inbound
                threads, set <code className="text-xs">SENDGRID_MODE=demo</code> and use Simulate, or
                configure Inbound Parse webhooks for production.
              </p>
              <Button onClick={handleSimulateEmail} disabled={simulatingEmail}>
                <Bot className="mr-2 h-4 w-4" />
                Simulate Demo Email
              </Button>
            </CardContent>
          </Card>
        ) : (
          conversations.map((conversation) => (
            <Card
              key={conversation.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedConversation(conversation.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{conversation.subject}</CardTitle>
                      <Badge variant={getStatusColor(conversation.status)}>
                        {conversation.status}
                      </Badge>
                      {conversation.intent && (
                        <Badge variant={getIntentColor(conversation.intent)}>
                          {formatIntent(conversation.intent)}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <span className="font-medium">{conversation.customer_email}</span>
                      {conversation.customer_name && (
                        <span className="text-muted-foreground">({conversation.customer_name})</span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(conversation.last_message_at), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    <span>{conversation.message_count} messages</span>
                  </div>
                  {conversation.status === "escalated" && (
                    <div className="flex items-center gap-1 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span>Needs attention</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialogs */}
      <EmailComposeDialog open={composeOpen} onOpenChange={setComposeOpen} onSuccess={handleRefresh} />
      {selectedConversation && (
        <ConversationDetailDialog
          conversationId={selectedConversation}
          open={!!selectedConversation}
          onOpenChange={(open) => !open && setSelectedConversation(null)}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
