'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BentoGrid,
  BentoCard,
  BentoCardHeader,
  BentoCardTitle,
  BentoCardDescription,
  BentoCardContent,
} from '@/components/ui/bento-grid';
import { BorderBeam } from '@/components/ui/border-beam';
import { MediaGenerator } from '@/components/ai-marketing/media-generator';
import { AssetLibrary } from '@/components/ai-marketing/asset-library';
import {
  Sparkles,
  TrendingUp,
  Zap,
  Image as ImageIcon,
  Loader2,
  Copy,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  marketingApi,
  type CampaignResponse,
  type GenerateCampaignRequest,
} from '@/lib/api/marketing';
import { isDemoMode } from '@/lib/demo-mode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

interface MarketingStats {
  totalAssets: number;
  imagesGenerated: number;
  copyGenerated: number;
  thisMonth: number;
}

// ---------------------------------------------------------------------------
// Campaign Dialog Component
// ---------------------------------------------------------------------------

interface CampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCampaignType?: GenerateCampaignRequest['campaign_type'];
  title: string;
}

function CampaignDialog({
  open,
  onOpenChange,
  defaultCampaignType = 'email',
  title,
}: CampaignDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CampaignResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState<GenerateCampaignRequest>({
    product_name: '',
    target_audience: '',
    campaign_type: defaultCampaignType,
    tone: 'professional',
  });

  const handleGenerate = async () => {
    if (!form.product_name.trim() || !form.target_audience.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in Product Name and Target Audience.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const data = await marketingApi.generateCampaign(form);
      setResult(data);
      toast({ title: 'Campaign generated', description: 'Your campaign copy is ready.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate campaign.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = `Subject: ${result.campaign_subject}\n\n${result.campaign_body}\n\nCTA: ${result.cta}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setResult(null);
    setForm({
      product_name: '',
      target_audience: '',
      campaign_type: defaultCampaignType,
      tone: 'professional',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Enter your cleaning equipment product details and let AI generate the copy.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="product_name">Product Name</Label>
              <Input
                id="product_name"
                placeholder="e.g. KÃ¤rcher K7 Premium Pressure Washer"
                value={form.product_name}
                onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_audience">Target Audience</Label>
              <Input
                id="target_audience"
                placeholder="e.g. Professional cleaners and tradespeople"
                value={form.target_audience}
                onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Campaign Type</Label>
                <Select
                  value={form.campaign_type}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      campaign_type: v as GenerateCampaignRequest['campaign_type'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="social">Social Media</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tone</Label>
                <Select
                  value={form.tone ?? 'professional'}
                  onValueChange={(v) => setForm((f) => ({ ...f, tone: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Subject / Headline
              </p>
              <p className="text-sm font-semibold">{result.campaign_subject}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Body Copy
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.campaign_body}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                CTA:
              </p>
              <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
                {result.cta}
              </span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {result ? (
            <>
              <Button variant="outline" onClick={() => setResult(null)}>
                Regenerate
              </Button>
              <Button onClick={handleCopy} variant="outline">
                {copied ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" /> Copy All
                  </>
                )}
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> Generate
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MarketingPage() {
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<{
    title: string;
    campaignType: GenerateCampaignRequest['campaign_type'];
  }>({ title: 'Generate Campaign', campaignType: 'email' });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setStatsError(null);
    try {
      const data = await marketingApi.getStats();
      setStats(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load marketing stats';
      console.error('[UNI-2116] Marketing stats fetch failed:', message);

      if (isDemoMode()) {
        // Demo mode only: use placeholder data so the UI is not completely empty
        console.warn('[UNI-2116] DEMO MODE active — using demo marketing stats');
        setStats({
          totalAssets: 47,
          imagesGenerated: 28,
          copyGenerated: 19,
          thisMonth: 12,
        });
      } else {
        // Production/staging: surface the error
        setStatsError(message);
        setStats(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const openCampaignDialog = (
    title: string,
    campaignType: GenerateCampaignRequest['campaign_type']
  ) => {
    setDialogConfig({ title, campaignType });
    setDialogOpen(true);
  };

  const statCards = stats
    ? [
        {
          title: 'Total Assets',
      value: stats.totalAssets,
      icon: Sparkles,
      color: 'text-brand-primary',
      bgColor: 'bg-brand-primary/10',
    },
    {
      title: 'Images Generated',
      value: stats.imagesGenerated,
      icon: ImageIcon,
      color: 'text-brand-secondary',
      bgColor: 'bg-brand-secondary/10',
    },
    {
      title: 'Copy Generated',
      value: stats.copyGenerated,
      icon: Zap,
      color: 'text-brand-accent',
      bgColor: 'bg-brand-accent/10',
    },
    {
      title: 'This Month',
      value: stats.thisMonth,
      icon: TrendingUp,
          color: 'text-success',
          bgColor: 'bg-success/10',
        },
      ]
    : [];

  return (
    <ErrorBoundary>
      <div className="space-y-8 pb-12">
        {/* Campaign Generation Dialog */}
        <CampaignDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          defaultCampaignType={dialogConfig.campaignType}
          title={dialogConfig.title}
        />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-semibold tracking-tight">
            AI Marketing Hub â€” Cleaning Equipment
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Generate professional cleaning equipment marketing assets with AI-powered tools
          </p>
        </motion.div>

        {/* Bento Grid Layout */}
        <BentoGrid columns={4} gap="lg">
          {/* Stats Row — UNI-2116: show error state when stats API fails */}
          {statsError ? (
            <BentoCard variant="glass" span={4} className="min-h-[120px]">
              <BentoCardContent className="p-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
                  <div>
                    <p className="font-medium text-destructive">Marketing stats unavailable</p>
                    <p className="text-sm text-muted-foreground mt-1">{statsError}</p>
                  </div>
                </div>
              </BentoCardContent>
            </BentoCard>
          ) : (
            statCards.map((stat) => (
              <BentoCard key={stat.title} variant="glass" span={1} className="min-h-[120px]">
                <BentoCardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-sm font-medium">{stat.title}</p>
                      <p className="text-3xl font-bold">
                        {loading ? (
                          <span className="bg-muted/20 inline-block h-8 w-16 animate-pulse rounded" />
                        ) : (
                          stat.value
                        )}
                      </p>
                    </div>
                    <div className={`rounded-lg p-3 ${stat.bgColor} border border-white/10`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                </BentoCardContent>
              </BentoCard>
            ))
          )}

          {/* AI Media Generator - Large card spanning 2 columns with BorderBeam */}
          <BorderBeam>
            <MediaGenerator variant="glass" span={2} className="min-h-[600px]" />
          </BorderBeam>

          {/* Quick Actions Card - 2 columns */}
          <BentoCard variant="gradient" span={2} className="min-h-[600px]">
            <BentoCardHeader>
              <BentoCardTitle className="text-white">Quick Actions</BentoCardTitle>
              <BentoCardDescription className="text-white/80">
                Common CCW marketing tasks and templates
              </BentoCardDescription>
            </BentoCardHeader>
            <BentoCardContent>
              <div className="grid gap-4">
                <button
                  type="button"
                  onClick={() => openCampaignDialog('Product Launch Campaign', 'email')}
                  className="w-full cursor-pointer rounded-lg border border-white/20 bg-white/10 p-4 text-left transition-colors hover:bg-white/15"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white/10 p-2">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-white">Product Launch Campaign</h4>
                      <p className="mt-1 text-xs text-white/70">
                        Generate hero images and announcement copy
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => openCampaignDialog('Social Media Bundle', 'social')}
                  className="w-full cursor-pointer rounded-lg border border-white/20 bg-white/10 p-4 text-left transition-colors hover:bg-white/15"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white/10 p-2">
                      <ImageIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-white">Social Media Bundle</h4>
                      <p className="mt-1 text-xs text-white/70">
                        Create complete social media post package
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => openCampaignDialog('Email Newsletter', 'email')}
                  className="w-full cursor-pointer rounded-lg border border-white/20 bg-white/10 p-4 text-left transition-colors hover:bg-white/15"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white/10 p-2">
                      <Zap className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-white">Email Newsletter</h4>
                      <p className="mt-1 text-xs text-white/70">
                        Generate engaging email content and visuals
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => openCampaignDialog('Ad Campaign Assets', 'social')}
                  className="w-full cursor-pointer rounded-lg border border-white/20 bg-white/10 p-4 text-left transition-colors hover:bg-white/15"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white/10 p-2">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-white">Ad Campaign Assets</h4>
                      <p className="mt-1 text-xs text-white/70">
                        Create multiple ad variations and copy
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </BentoCardContent>
          </BentoCard>

          {/* Asset Library - Full width spanning 4 columns */}
          <AssetLibrary variant="glass" span={4} />

          {/* Tips & Best Practices - 2 columns */}
          <BentoCard variant="elevated" span={2} className="min-h-[300px]">
            <BentoCardHeader>
              <BentoCardTitle>Tips & Best Practices</BentoCardTitle>
              <BentoCardDescription>Get the most out of AI generation</BentoCardDescription>
            </BentoCardHeader>
            <BentoCardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="bg-brand-primary/20 text-brand-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    1
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Be Specific with Prompts</h4>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Include details about style, mood, colors, and composition for better results
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="bg-brand-primary/20 text-brand-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    2
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Iterate and Refine</h4>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Generate multiple variations and refine prompts based on results
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="bg-brand-primary/20 text-brand-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    3
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Use Templates</h4>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Start with quick action templates for common marketing tasks
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="bg-brand-primary/20 text-brand-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    4
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Maintain Brand Voice</h4>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Review and adjust generated content to match your brand guidelines
                    </p>
                  </div>
                </div>
              </div>
            </BentoCardContent>
          </BentoCard>

          {/* Recent Activity - 2 columns */}
          <BentoCard variant="glass" span={2} className="min-h-[300px]">
            <BentoCardHeader>
              <BentoCardTitle>Recent Activity</BentoCardTitle>
              <BentoCardDescription>Your latest AI generations</BentoCardDescription>
            </BentoCardHeader>
            <BentoCardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="bg-card/50 flex gap-3 rounded-lg border border-white/10 p-3"
                    >
                      <div className="bg-muted/20 h-10 w-10 animate-pulse rounded" />
                      <div className="flex-1 space-y-2">
                        <div className="bg-muted/20 h-4 animate-pulse rounded" />
                        <div className="bg-muted/20 h-3 w-2/3 animate-pulse rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-card/50 hover:bg-card/80 flex cursor-pointer gap-3 rounded-lg border border-white/10 p-3 transition-colors">
                    <div className="bg-brand-primary/20 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded">
                      <ImageIcon className="text-brand-primary h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">Product Launch Hero</p>
                      <p className="text-muted-foreground text-xs">2 hours ago</p>
                    </div>
                  </div>

                  <div className="bg-card/50 hover:bg-card/80 flex cursor-pointer gap-3 rounded-lg border border-white/10 p-3 transition-colors">
                    <div className="bg-brand-secondary/20 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded">
                      <Zap className="text-brand-secondary h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">Email Campaign Copy</p>
                      <p className="text-muted-foreground text-xs">1 day ago</p>
                    </div>
                  </div>

                  <div className="bg-card/50 hover:bg-card/80 flex cursor-pointer gap-3 rounded-lg border border-white/10 p-3 transition-colors">
                    <div className="bg-brand-primary/20 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded">
                      <ImageIcon className="text-brand-primary h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">Social Media Banner</p>
                      <p className="text-muted-foreground text-xs">2 days ago</p>
                    </div>
                  </div>

                  <div className="bg-card/50 hover:bg-card/80 flex cursor-pointer gap-3 rounded-lg border border-white/10 p-3 transition-colors">
                    <div className="bg-brand-secondary/20 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded">
                      <Zap className="text-brand-secondary h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">Ad Copy Variation</p>
                      <p className="text-muted-foreground text-xs">3 days ago</p>
                    </div>
                  </div>
                </div>
              )}
            </BentoCardContent>
          </BentoCard>
        </BentoGrid>
      </div>
    </ErrorBoundary>
  );
}
