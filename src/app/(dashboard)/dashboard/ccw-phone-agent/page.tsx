'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Bot,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Mail,
  PhoneCall,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

type PhoneConfig = {
  status: string;
  effective_safety: {
    approved_knowledge_only: boolean;
    outbound_ai_calling_enabled: boolean;
    call_recording_enabled: boolean;
    recording_requested: boolean;
    outbound_requested: boolean;
    human_handoff_required_for: string[];
  };
  pilot_status: {
    ready_for_inbound_pilot: boolean;
    mode: string;
    provider_config: {
      owner_contact_email: string;
      missing_env: string[];
      webhook_urls: {
        twilio_voice_url: string | null;
        elevenlabs_callback_url: string | null;
      };
    };
  };
};

type CallSession = {
  id: string;
  intent: string | null;
  outcome: string | null;
  summary: string | null;
  handoff_required: boolean;
  triage_decision: { decision: string; reason: string; confidence_score: number | null } | null;
  counts: { insights: number; follow_up_actions: number };
  updated_at: string;
};

type Agent = {
  id: string;
  agent_code: string;
  name: string;
  status: string;
  requires_approval: boolean;
  counts: { learning_items: number; follow_up_rules: number };
};

type FollowUpAction = {
  id: string;
  action_type: string;
  channel: string;
  status: string;
  subject: string | null;
  body: string | null;
  created_at: string;
};

type IndustryEvent = {
  id: string;
  event_type: string;
  name: string;
  status: string;
  starts_at: string | null;
};

type RoadshowCampaign = {
  campaign_slug: string;
  booking_url: string;
  owner_email: string;
  distribution_email: string;
  ready_for_client_list_send: boolean;
  ready_count: number;
  total_count: number;
  items: Array<{ key: string; label: string; ready: boolean; blocker?: string }>;
  compliance_state: RoadshowComplianceState;
  saved_events: Array<{ id: string; name: string; status: string; starts_at: string | null; venue: string | null }>;
  trusted_sources: Array<{ id: string; label: string; url: string | null; status: string }>;
  internal_test_drafts: Array<{
    id: string;
    recipient_ref: string | null;
    subject: string | null;
    status: string;
    sent_at: string | null;
  }>;
  internal_test_send?: {
    status: string;
    detail?: string;
    results?: Array<{ action_id: string; recipient_ref: string | null; status: string; detail?: string }>;
  };
};

type RoadshowComplianceKey =
  | 'client_list_source_confirmed'
  | 'consent_basis_confirmed'
  | 'suppression_rules_confirmed'
  | 'unsubscribe_url_confirmed'
  | 'sender_footer_confirmed'
  | 'seat_capacity_confirmed'
  | 'final_approval_confirmed';

type RoadshowComplianceState = Record<RoadshowComplianceKey, boolean> & {
  updated_by: string | null;
  updated_at: string | null;
  notes: string | null;
};

const roadshowComplianceControls: Array<{ key: RoadshowComplianceKey; label: string }> = [
  { key: 'client_list_source_confirmed', label: 'Client-list source and export date confirmed' },
  { key: 'consent_basis_confirmed', label: 'Marketing consent basis confirmed' },
  { key: 'suppression_rules_confirmed', label: 'Suppressions and unsubscribes excluded' },
  { key: 'unsubscribe_url_confirmed', label: 'Working unsubscribe URL confirmed' },
  { key: 'sender_footer_confirmed', label: 'Sender business footer confirmed' },
  { key: 'seat_capacity_confirmed', label: 'Venue capacity and limited-places claim confirmed' },
  { key: 'final_approval_confirmed', label: 'Toby final approval recorded' },
];

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.detail === 'string' ? body.detail : 'Request failed';
    throw new Error(message);
  }
  return body as T;
}

function badgeVariant(value: string | boolean) {
  if (value === true || value === 'active' || value === 'pilot_approved' || value === 'self_serve') return 'success' as const;
  if (value === 'draft' || value === 'pilot_requested' || value === 'draft_follow_up') return 'pending' as const;
  if (value === false || value === 'human_handoff') return 'destructive' as const;
  return 'outline' as const;
}

function formatDate(value: string | null) {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

const DEFAULT_TRANSCRIPT =
  'Customer wants to book a machine service and asks about the maintenance interval. They also asked whether CCW can email options.';

export default function CcwPhoneAgentPage() {
  const [config, setConfig] = useState<PhoneConfig | null>(null);
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpAction[]>([]);
  const [events, setEvents] = useState<IndustryEvent[]>([]);
  const [roadshow, setRoadshow] = useState<RoadshowCampaign | null>(null);
  const [transcript, setTranscript] = useState(DEFAULT_TRANSCRIPT);
  const [summary, setSummary] = useState('Service booking discovery call');
  const [eventName, setEventName] = useState('CCW Company Day - Supplier Showcase');
  const [linkCustomerId, setLinkCustomerId] = useState('');
  const [linkContactId, setLinkContactId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configData, callData, agentData, followUpData, eventData, roadshowData] = await Promise.all([
        readJson<PhoneConfig>(await fetch('/api/phone-agent/config', { cache: 'no-store' })),
        readJson<{ items: CallSession[] }>(await fetch('/api/phone-agent/call-sessions', { cache: 'no-store' })),
        readJson<{ items: Agent[] }>(await fetch('/api/phone-agent/specialized-agents', { cache: 'no-store' })),
        readJson<{ items: FollowUpAction[] }>(
          await fetch('/api/phone-agent/follow-up-actions?status=draft', { cache: 'no-store' })
        ),
        readJson<{ items: IndustryEvent[] }>(await fetch('/api/phone-agent/industry-events', { cache: 'no-store' })),
        readJson<RoadshowCampaign>(await fetch('/api/phone-agent/roadshow-campaign', { cache: 'no-store' })),
      ]);
      setConfig(configData);
      setCalls(callData.items);
      setAgents(agentData.items);
      setFollowUps(followUpData.items);
      setEvents(eventData.items);
      setRoadshow(roadshowData);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function requestPilot() {
    setSaving(true);
    setError(null);
    try {
      const data = await readJson<PhoneConfig>(
        await fetch('/api/phone-agent/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'pilot_requested',
            approved_knowledge_only: true,
            recording_requested: true,
            outbound_requested: false,
          }),
        })
      );
      setConfig(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function seedAgents() {
    setSaving(true);
    setError(null);
    try {
      await readJson(await fetch('/api/phone-agent/specialized-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed_defaults: true }),
      }));
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function captureCall() {
    setSaving(true);
    setError(null);
    try {
      await readJson(await fetch('/api/phone-agent/call-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          transcript,
          direction: 'inbound',
          channel: 'phone',
          source: 'dashboard_capture',
        }),
      }));
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function createEvent() {
    setSaving(true);
    setError(null);
    try {
      await readJson(await fetch('/api/phone-agent/industry-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: eventName, event_type: 'company_day' }),
      }));
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function seedRoadshowCampaign() {
    setSaving(true);
    setError(null);
    try {
      const data = await readJson<RoadshowCampaign>(
        await fetch('/api/phone-agent/roadshow-campaign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seed_events: true,
            seed_sources: true,
            seed_internal_drafts: true,
          }),
        })
      );
      setRoadshow(data);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function updateRoadshowCompliance(key: RoadshowComplianceKey, value: boolean) {
    setRoadshow((current) => {
      if (!current) return current;
      return {
        ...current,
        compliance_state: {
          ...current.compliance_state,
          [key]: value,
        },
      };
    });
  }

  function updateRoadshowNotes(value: string) {
    setRoadshow((current) => {
      if (!current) return current;
      return {
        ...current,
        compliance_state: {
          ...current.compliance_state,
          notes: value,
        },
      };
    });
  }

  async function saveRoadshowReadiness() {
    if (!roadshow) return;
    setSaving(true);
    setError(null);
    try {
      const data = await readJson<RoadshowCampaign>(
        await fetch('/api/phone-agent/roadshow-campaign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seed_events: false,
            seed_sources: false,
            seed_internal_drafts: false,
            ...roadshow.compliance_state,
          }),
        })
      );
      setRoadshow(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function sendRoadshowInternalTests() {
    setSaving(true);
    setError(null);
    try {
      const data = await readJson<RoadshowCampaign>(
        await fetch('/api/phone-agent/roadshow-campaign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seed_events: false,
            seed_sources: false,
            seed_internal_drafts: false,
            send_internal_tests: true,
            ...(roadshow?.compliance_state ?? {}),
          }),
        })
      );
      setRoadshow(data);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function promoteLearning(callId: string) {
    setSaving(true);
    setError(null);
    try {
      await readJson(
        await fetch(`/api/phone-agent/call-sessions/${callId}/learning`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function linkCall(callId: string) {
    setSaving(true);
    setError(null);
    try {
      await readJson(
        await fetch(`/api/phone-agent/call-sessions/${callId}/link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: linkCustomerId,
            contact_id: linkContactId,
          }),
        })
      );
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function updateFollowUp(actionId: string, action: 'approve' | 'reject') {
    setSaving(true);
    setError(null);
    try {
      await readJson(
        await fetch(`/api/phone-agent/follow-up-actions/${actionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        })
      );
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <PhoneCall className="h-7 w-7 text-muted-foreground" aria-hidden />
            <h1 className="text-3xl font-bold tracking-tight">CCW Phone Agent</h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Discover calls, draft follow-ups, train specialised agents, and keep every consequential action behind review.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAll} disabled={loading} leftIcon={<RefreshCw />}>
            Refresh
          </Button>
          <Button onClick={requestPilot} disabled={saving} leftIcon={<ShieldAlert />}>
            Request Pilot
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pilot Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant={badgeVariant(config?.status ?? 'draft')}>{config?.status ?? 'draft'}</Badge>
            <p className="text-xs text-muted-foreground">{config?.pilot_status.mode ?? 'Loading'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Inbound Ready</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant={badgeVariant(Boolean(config?.pilot_status.ready_for_inbound_pilot))}>
              {config?.pilot_status.ready_for_inbound_pilot ? 'ready' : 'blocked'}
            </Badge>
            <p className="text-xs text-muted-foreground">
              {config?.pilot_status.provider_config.missing_env.length ?? 0} provider values missing
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Draft Follow-Ups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{followUps.length}</div>
            <p className="text-xs text-muted-foreground">No send path without approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Specialised Agents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{agents.length}</div>
            <p className="text-xs text-muted-foreground">All require approval before activation</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="calls" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calls">Calls</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="follow-ups">Follow-Ups</TabsTrigger>
          <TabsTrigger value="roadshow">Roadshow</TabsTrigger>
          <TabsTrigger value="events">Company Days</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
        </TabsList>

        <TabsContent value="calls">
          <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Capture Conversation</CardTitle>
                <CardDescription>Paste or import a discovered call to triage it into the CRM.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="summary">Summary</Label>
                  <Input id="summary" value={summary} onChange={(event) => setSummary(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transcript">Transcript</Label>
                  <Textarea
                    id="transcript"
                    value={transcript}
                    onChange={(event) => setTranscript(event.target.value)}
                    className="min-h-[220px]"
                  />
                </div>
                <Button onClick={captureCall} disabled={saving} leftIcon={<Sparkles />}>
                  Triage
                </Button>
                <div className="grid gap-3 border-t pt-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="link-customer-id">Customer ID</Label>
                    <Input
                      id="link-customer-id"
                      value={linkCustomerId}
                      onChange={(event) => setLinkCustomerId(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="link-contact-id">Contact ID</Label>
                    <Input
                      id="link-contact-id"
                      value={linkContactId}
                      onChange={(event) => setLinkContactId(event.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Discovered Calls</CardTitle>
                <CardDescription>{calls.length} conversations captured.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {calls.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No calls captured yet.
                  </div>
                ) : (
                  calls.map((call) => (
                    <div key={call.id} className="rounded-md border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-medium">{call.summary ?? 'Captured call'}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">{formatDate(call.updated_at)}</p>
                        </div>
                        <Badge variant={badgeVariant(call.triage_decision?.decision ?? '')}>
                          {call.triage_decision?.decision ?? 'untriaged'}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {call.triage_decision?.reason ?? call.outcome ?? 'No triage reason recorded.'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{call.intent ?? 'unknown'} intent</span>
                        <span>{call.counts.insights} insights</span>
                        <span>{call.counts.follow_up_actions} follow-ups</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => promoteLearning(call.id)}
                          disabled={saving}
                          leftIcon={<Bot />}
                        >
                          Promote Learning
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => linkCall(call.id)}
                          disabled={saving || (!linkCustomerId && !linkContactId)}
                          leftIcon={<CheckCircle2 />}
                        >
                          Link CRM
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Specialised Agents</CardTitle>
                  <CardDescription>Playbooks generated for leads, sales, service, training, campaigns, and events.</CardDescription>
                </div>
                <Button onClick={seedAgents} disabled={saving} leftIcon={<Bot />}>
                  Seed Defaults
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-2">
              {agents.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Seed the default agent roster to start learning from calls.
                </div>
              ) : (
                agents.map((agent) => (
                  <div key={agent.id} className="rounded-md border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">{agent.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{agent.agent_code}</p>
                      </div>
                      <Badge variant={badgeVariant(agent.status)}>{agent.status}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{agent.counts.learning_items} learnings</span>
                      <span>{agent.counts.follow_up_rules} rules</span>
                      <span>{agent.requires_approval ? 'approval gated' : 'approved'}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="follow-ups">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Draft Follow-Ups</CardTitle>
              <CardDescription>Emails, service reminders, training replies, event invites, and phone tasks stay drafted.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-2">
              {followUps.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No draft follow-ups yet.
                </div>
              ) : (
                followUps.map((action) => (
                  <div key={action.id} className="rounded-md border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">{action.subject ?? action.action_type}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {action.channel} · {formatDate(action.created_at)}
                        </p>
                      </div>
                      <Badge variant={badgeVariant(action.status)}>{action.status}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{action.body}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateFollowUp(action.id, 'reject')}
                        disabled={saving}
                        leftIcon={<ShieldAlert />}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateFollowUp(action.id, 'approve')}
                        disabled={saving}
                        leftIcon={<Send />}
                      >
                        Approve Draft
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roadshow">
          <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">CARSI x CCW Roadshow</CardTitle>
                <CardDescription>
                  Operational campaign gate for the Melbourne and Sydney Business Growth Days.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">Client-list send status</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {roadshow?.ready_count ?? 0} of {roadshow?.total_count ?? 0} readiness gates complete.
                      </p>
                    </div>
                    <Badge variant={badgeVariant(Boolean(roadshow?.ready_for_client_list_send))}>
                      {roadshow?.ready_for_client_list_send ? 'send ready' : 'blocked'}
                    </Badge>
                  </div>
                </div>
                <div className="grid gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Booking URL</div>
                    <a
                      className="inline-flex items-center gap-1 break-all font-mono text-xs text-primary hover:underline"
                      href={roadshow?.booking_url ?? 'https://www.carsi.com.au/events/ccw-roadshow'}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {roadshow?.booking_url ?? 'https://www.carsi.com.au/events/ccw-roadshow'}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Approval owner</div>
                    <div className="font-mono text-xs">{roadshow?.owner_email ?? 'toby.b@ccwarehouse.com.au'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Distribution test</div>
                    <div className="font-mono text-xs">
                      {roadshow?.distribution_email ?? 'annef@ccwarehouse.com.au'}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={seedRoadshowCampaign} disabled={saving} leftIcon={<Mail />}>
                    Seed Roadshow Campaign
                  </Button>
                  <Button
                    variant="outline"
                    onClick={sendRoadshowInternalTests}
                    disabled={saving}
                    leftIcon={<Send />}
                  >
                    Send Internal Tests
                  </Button>
                </div>
                {roadshow?.internal_test_send ? (
                  <div className="rounded-md border p-3 text-sm">
                    <div className="font-medium">Internal test send: {roadshow.internal_test_send.status}</div>
                    {roadshow.internal_test_send.detail ? (
                      <p className="mt-1 text-muted-foreground">{roadshow.internal_test_send.detail}</p>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Readiness Gates</CardTitle>
                  <CardDescription>
                    The CRM can prepare the send, but customer-list delivery stays blocked until every gate is green.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 lg:grid-cols-2">
                  {(roadshow?.items ?? []).map((item) => (
                    <div key={item.key} className="rounded-md border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-medium">{item.label}</div>
                        <Badge variant={badgeVariant(item.ready)}>{item.ready ? 'ready' : 'blocked'}</Badge>
                      </div>
                      {!item.ready && item.blocker ? (
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.blocker}</p>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Compliance Approval Record</CardTitle>
                      <CardDescription>
                        Saved operational sign-off before any CCW client-list send can be marked ready.
                      </CardDescription>
                    </div>
                    <Button onClick={saveRoadshowReadiness} disabled={saving || !roadshow} leftIcon={<CheckCircle2 />}>
                      Save Readiness
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-2">
                    {roadshowComplianceControls.map((control) => (
                      <label
                        key={control.key}
                        className="flex min-h-16 cursor-pointer items-start gap-3 rounded-md border p-4 text-sm"
                      >
                        <Checkbox
                          className="mt-0.5"
                          checked={roadshow?.compliance_state[control.key] ?? false}
                          onCheckedChange={(checked) => updateRoadshowCompliance(control.key, checked === true)}
                          disabled={!roadshow || saving}
                        />
                        <span className="font-medium leading-relaxed">{control.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="roadshow-notes">Source, segment and approval notes</Label>
                    <Textarea
                      id="roadshow-notes"
                      value={roadshow?.compliance_state.notes ?? ''}
                      onChange={(event) => updateRoadshowNotes(event.target.value)}
                      placeholder="Client-list source, export date, segment counts, suppression count, approver and approval timestamp."
                      rows={3}
                      disabled={!roadshow || saving}
                    />
                  </div>
                  {roadshow?.compliance_state.updated_at ? (
                    <div className="text-xs text-muted-foreground">
                      Last saved {formatDate(roadshow.compliance_state.updated_at)}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Saved Events</CardTitle>
                    <CardDescription>{roadshow?.saved_events.length ?? 0} campaign events.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(roadshow?.saved_events ?? []).length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        Seed the campaign to create Melbourne and Sydney records.
                      </div>
                    ) : (
                      roadshow?.saved_events.map((event) => (
                        <div key={event.id} className="rounded-md border p-3 text-sm">
                          <div className="font-medium">{event.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{formatDate(event.starts_at)}</div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Trusted Sources</CardTitle>
                    <CardDescription>{roadshow?.trusted_sources.length ?? 0} approved sources.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(roadshow?.trusted_sources ?? []).length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        Seed CARSI, CCW and booking-page sources.
                      </div>
                    ) : (
                      roadshow?.trusted_sources.map((source) => (
                        <div key={source.id} className="rounded-md border p-3 text-sm">
                          <div className="font-medium">{source.label}</div>
                          <div className="mt-1 break-all text-xs text-muted-foreground">{source.url}</div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Internal Drafts</CardTitle>
                    <CardDescription>{roadshow?.internal_test_drafts.length ?? 0} test drafts.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(roadshow?.internal_test_drafts ?? []).length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        Seed Toby and Anne draft approvals.
                      </div>
                    ) : (
                      roadshow?.internal_test_drafts.map((draft) => (
                        <div key={draft.id} className="rounded-md border p-3 text-sm">
                          <div className="font-medium">{draft.subject}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{draft.recipient_ref}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant={badgeVariant(draft.status)}>{draft.status}</Badge>
                            {draft.sent_at ? <Badge variant="outline">sent {formatDate(draft.sent_at)}</Badge> : null}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="events">
          <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Company Day Concept</CardTitle>
                <CardDescription>Create CCW industry feel, appreciation days, and supplier showcases.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="event-name">Event</Label>
                  <Input id="event-name" value={eventName} onChange={(event) => setEventName(event.target.value)} />
                </div>
                <Button onClick={createEvent} disabled={saving} leftIcon={<CalendarDays />}>
                  Create
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Industry Events</CardTitle>
                <CardDescription>{events.length} event concepts saved.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {events.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No company day concepts yet.
                  </div>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="rounded-md border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-medium">{event.name}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {event.event_type} · {formatDate(event.starts_at)}
                          </p>
                        </div>
                        <Badge variant={badgeVariant(event.status)}>{event.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="safety">
          <Card>
            <CardHeader>
            <CardTitle className="text-base">Human Gates</CardTitle>
              <CardDescription>Consequential phone-agent actions remain blocked until Toby supplies live keys and approval.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-md border p-4 lg:col-span-2">
                <div className="font-medium">Provider Callback URLs</div>
                <dl className="mt-3 grid gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Owner approval contact</dt>
                    <dd className="break-all font-mono text-xs">
                      {config?.pilot_status.provider_config.owner_contact_email ?? 'toby.b@ccwarehouse.com.au'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Twilio voice webhook</dt>
                    <dd className="break-all font-mono text-xs">
                      {config?.pilot_status.provider_config.webhook_urls.twilio_voice_url ?? 'Set PHONE_AGENT_PUBLIC_BASE_URL'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">ElevenLabs conversation callback</dt>
                    <dd className="break-all font-mono text-xs">
                      {config?.pilot_status.provider_config.webhook_urls.elevenlabs_callback_url ??
                        'Set PHONE_AGENT_PUBLIC_BASE_URL'}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-md border p-4 lg:col-span-2">
                <div className="font-medium">Missing Live Inputs</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(config?.pilot_status.provider_config.missing_env ?? []).length === 0 ? (
                    <Badge variant="success">all provider keys configured</Badge>
                  ) : (
                    config?.pilot_status.provider_config.missing_env.map((item) => (
                      <Badge key={item} variant="pending">
                        {item}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-md border p-4">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  Approved knowledge only
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {config?.effective_safety.approved_knowledge_only ? 'Enabled' : 'Not enabled'}
                </p>
              </div>
              <div className="rounded-md border p-4">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                  Outbound and recording
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Outbound enabled: {String(config?.effective_safety.outbound_ai_calling_enabled ?? false)} · recording enabled:{' '}
                  {String(config?.effective_safety.call_recording_enabled ?? false)}
                </p>
              </div>
              {(config?.effective_safety.human_handoff_required_for ?? []).map((item) => (
                <div key={item} className="rounded-md border p-4 text-sm">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
