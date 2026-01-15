"use client";

import { Badge } from "@/components/ui/badge";
import {
  BentoCard,
  BentoCardDescription,
  BentoCardHeader,
  BentoCardTitle,
  BentoGrid
} from "@/components/ui/bento-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardImage } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FadeIn, Stagger } from "@/components/ui/motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  Copy,
  FileText,
  Filter,
  Loader2,
  Package,
  Receipt,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { toast } from "sonner";

interface CcwProduct {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  category: string;
  tags: string[];
  price: number;
  compareAtPrice: number | null;
  available: boolean;
  sku: string;
  image: string | null;
  description: string;
  url: string;
}

interface CcwProductsResponse {
  source: string;
  products: CcwProduct[];
}

type PipelineStage =
  | "quote_prepared"
  | "quote_sent"
  | "order_confirmed"
  | "invoice_issued";

interface StageTimestamps {
  quotePreparedAt: string | null;
  quoteSentAt: string | null;
  orderConfirmedAt: string | null;
  invoiceIssuedAt: string | null;
}

export default function CcwShowroomPage() {
  const [products, setProducts] = useState<CcwProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<CcwProduct | null>(null);
  const [prompt, setPrompt] = useState("");
  const [summary, setSummary] = useState("");
  const [summarySource, setSummarySource] = useState<"shopify" | "jina">("shopify");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [stage, setStage] = useState<PipelineStage>("quote_prepared");
  const [stageTimestamps, setStageTimestamps] = useState<StageTimestamps>({
    quotePreparedAt: null,
    quoteSentAt: null,
    orderConfirmedAt: null,
    invoiceIssuedAt: null,
  });
  const [quoteNumber, setQuoteNumber] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  // Initialize random numbers on client only to avoid hydration mismatch
  useEffect(() => {
    setQuoteNumber(generateNumber("Q"));
    setOrderNumber(generateNumber("ORD"));
    setInvoiceNumber(generateNumber("INV"));
  }, []);

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      try {
        const response = await fetch("/api/ccw/products?limit=60");
        if (!response.ok) {
          throw new Error("Failed to load CCW products");
        }
        const data = (await response.json()) as CcwProductsResponse;
        setProducts(data.products ?? []);
        setSelected(data.products?.[0] ?? null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load products");
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  useEffect(() => {
    if (!selected) return;
    const nextPrompt = [
      `Create a product launch campaign for ${selected.title}.`,
      `Highlight key benefits for cleaning professionals and facility teams.`,
      `Price: ${formatCurrency(selected.price)} AUD.`,
      "Include a headline, three bullet benefits, and a clear CTA to order.",
    ].join(" ");

    setPrompt(nextPrompt);
    setSummary(selected.description || "No description available yet.");
    setSummarySource("shopify");
  }, [selected]);

  useEffect(() => {
    const now = new Date().toISOString();
    setStage("quote_prepared");
    setStageTimestamps({
      quotePreparedAt: now,
      quoteSentAt: null,
      orderConfirmedAt: null,
      invoiceIssuedAt: null,
    });
    setQuoteNumber(generateNumber("Q"));
    setOrderNumber(generateNumber("ORD"));
    setInvoiceNumber(generateNumber("INV"));
  }, [selected?.id]);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    products.forEach((product) => {
      if (product.category) {
        unique.add(product.category);
      }
    });
    return ["all", ...Array.from(unique).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = category === "all" || product.category === category;
      const matchesQuery =
        !normalizedQuery ||
        product.title.toLowerCase().includes(normalizedQuery) ||
        product.vendor.toLowerCase().includes(normalizedQuery) ||
        product.sku.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [products, query, category]);

  const stats = useMemo(() => {
    const prices = products.map((product) => product.price).filter((price) => price > 0);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;
    const inStock = products.filter((product) => product.available).length;

    return {
      total: products.length,
      categories: Math.max(categories.length - 1, 0),
      priceRange: prices.length ? `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}` : "N/A",
      inStock,
    };
  }, [products, categories]);

  const quoteMetrics = useMemo(() => {
    const unitPrice = selected?.price ?? 0;
    const quantity = unitPrice ? 24 : 0;
    const lineTotal = unitPrice * quantity;
    const discountRate =
      lineTotal > 0
        ? selected?.compareAtPrice && selected.compareAtPrice > unitPrice
          ? Math.min((selected.compareAtPrice - unitPrice) / selected.compareAtPrice, 0.15)
          : 0.08
        : 0;
    const discount = lineTotal * discountRate;
    const shipping = lineTotal > 0 ? (lineTotal > 1200 ? 0 : 45) : 0;
    const subtotal = lineTotal - discount + shipping;
    const tax = subtotal * 0.1;
    const total = subtotal + tax;
    const cost = lineTotal * 0.6;
    const margin = subtotal - cost;
    return {
      unitPrice,
      quantity,
      lineTotal,
      discountRate,
      discount,
      shipping,
      subtotal,
      tax,
      total,
      margin,
    };
  }, [selected]);

  const customerProfile = {
    name: "Metro Facility Services",
    account: "CUST-2031",
    contact: "Samantha Cole",
    email: "ops@metrofss.au",
    phone: "+61 7 3123 4400",
    tier: "Enterprise",
    terms: "Net 14",
    creditLimit: 75000,
    balance: 16240,
    lastOrder: "12 Sep 2026",
    region: "Brisbane, QLD",
    rep: "J. Fielding",
  };

  const stageSequence: PipelineStage[] = [
    "quote_prepared",
    "quote_sent",
    "order_confirmed",
    "invoice_issued",
  ];

  const stageLabels: Record<PipelineStage, string> = {
    quote_prepared: "Quote prepared",
    quote_sent: "Quote sent",
    order_confirmed: "Order confirmed",
    invoice_issued: "Invoice issued",
  };

  const stageDescriptions: Record<PipelineStage, string> = {
    quote_prepared: "Gemini 3 curated the pitch and pricing notes.",
    quote_sent: "SendGrid + Fountain webhook shared the quote link.",
    order_confirmed: "Payment captured, order queued for fulfillment.",
    invoice_issued: "Invoice published via accounting webhook.",
  };

  const stageActions: Record<PipelineStage, string> = {
    quote_prepared: "Send quote",
    quote_sent: "Convert to order",
    order_confirmed: "Issue invoice",
    invoice_issued: "Pipeline complete",
  };

  const stageIconMap: Record<PipelineStage, ComponentType<{ className?: string }>> = {
    quote_prepared: Sparkles,
    quote_sent: FileText,
    order_confirmed: CheckCircle,
    invoice_issued: Receipt,
  };

  const timestampKeyMap: Record<PipelineStage, keyof StageTimestamps> = {
    quote_prepared: "quotePreparedAt",
    quote_sent: "quoteSentAt",
    order_confirmed: "orderConfirmedAt",
    invoice_issued: "invoiceIssuedAt",
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${day}/${month}/${year} ${displayHours}:${minutes} ${ampm}`;
  };

  const handleAdvanceStage = () => {
    if (!selected) {
      toast.error("Select a product before advancing the workflow.");
      return;
    }

    const currentIndex = stageSequence.indexOf(stage);
    if (currentIndex === stageSequence.length - 1) {
      toast.success("Pipeline already complete");
      return;
    }

    const nextStage = stageSequence[currentIndex + 1];
    const now = new Date().toISOString();
    setStage(nextStage);
    setStageTimestamps((prev) => ({
      ...prev,
      [timestampKeyMap[nextStage]]: now,
    }));
    toast.success(`${stageLabels[nextStage]} recorded`);
  };

  const handleResetPipeline = () => {
    const now = new Date().toISOString();
    setStage("quote_prepared");
    setStageTimestamps({
      quotePreparedAt: now,
      quoteSentAt: null,
      orderConfirmedAt: null,
      invoiceIssuedAt: null,
    });
    setQuoteNumber(generateNumber("Q"));
    setOrderNumber(generateNumber("ORD"));
    setInvoiceNumber(generateNumber("INV"));
  };

  const handleCopyPrompt = async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    toast.success("Prompt copied to clipboard");
  };

  const handleSummaryRefresh = async () => {
    if (!selected) return;
    setSummaryLoading(true);
    try {
      const response = await fetch(
        `/api/ccw/summary?url=${encodeURIComponent(selected.url)}`
      );
      if (!response.ok) {
        throw new Error("Unable to fetch Jina summary");
      }
      const data = (await response.json()) as { summary?: string };
      if (data.summary) {
        setSummary(data.summary);
        setSummarySource("jina");
      } else {
        toast.error("No summary returned from Jina");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-brand-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-brand-accent/20 blur-3xl" />

      <div className="container relative z-10 space-y-10 py-10 px-4">
        <FadeIn className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground shadow-sm">
            Live CCW product feed
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              <span className="bg-gradient-brand bg-clip-text text-transparent">
                CCW Showroom
              </span>
              <span className="block text-foreground">
                Modern ERP experiences with real products
              </span>
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Demonstrate the future CCW workflow with live Shopify products, AI-ready prompts, and
              a friction-free catalog experience.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="gradient"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Demo link copied to clipboard");
              }}
            >
              Share demo with client
            </Button>
            <Button variant="outline" asChild>
              <Link href="/marketing">Open marketing hub</Link>
            </Button>
          </div>
        </FadeIn>

        <BentoGrid columns={4} gap="lg">
          <BentoCard variant="glass" span={1}>
            <BentoCardHeader>
              <BentoCardTitle>{stats.total}</BentoCardTitle>
              <BentoCardDescription>Products available</BentoCardDescription>
            </BentoCardHeader>
          </BentoCard>
          <BentoCard variant="glass" span={1}>
            <BentoCardHeader>
              <BentoCardTitle>{stats.categories}</BentoCardTitle>
              <BentoCardDescription>Categories covered</BentoCardDescription>
            </BentoCardHeader>
          </BentoCard>
          <BentoCard variant="glass" span={1}>
            <BentoCardHeader>
              <BentoCardTitle>{stats.inStock}</BentoCardTitle>
              <BentoCardDescription>Ready to ship</BentoCardDescription>
            </BentoCardHeader>
          </BentoCard>
          <BentoCard variant="glass" span={1}>
            <BentoCardHeader>
              <BentoCardTitle>{stats.priceRange}</BentoCardTitle>
              <BentoCardDescription>Live price range</BentoCardDescription>
            </BentoCardHeader>
          </BentoCard>
        </BentoGrid>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-6">
            <Card variant="glass" className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Product Catalog</h2>
                    <p className="text-sm text-muted-foreground">
                      Search, filter, and select products to preview client flows.
                    </p>
                  </div>
                </div>
                <Badge variant="outline">Shopify feed</Badge>
              </div>

              <Separator className="my-6" />

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="flex-1">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by product name, SKU, or vendor"
                    className="h-11 bg-background/70"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    Category
                  </div>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-11 w-[180px] bg-background/70">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat === "all" ? "All categories" : cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {loading ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-72 rounded-xl border border-white/10 bg-card/50 animate-pulse"
                  />
                ))}
              </div>
            ) : error ? (
              <Card variant="outline" className="p-6">
                <p className="text-sm text-destructive">{error}</p>
              </Card>
            ) : filteredProducts.length === 0 ? (
              <Card variant="outline" className="p-6">
                <p className="text-sm text-muted-foreground">
                  No products match your search. Try another keyword or reset filters.
                </p>
              </Card>
            ) : (
              <Stagger staggerDelay={60} className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <FadeIn key={product.id} className="h-full">
                    <Card
                      variant="interactive"
                      className={`h-full overflow-hidden border ${
                        selected?.id === product.id
                          ? "border-brand-primary/50 shadow-glow"
                          : "border-border"
                      }`}
                      data-testid="product-card"
                      onClick={() => setSelected(product)}
                    >
                      {product.image ? (
                        <CardImage src={product.image} alt={product.title} />
                      ) : (
                        <div className="flex aspect-video items-center justify-center bg-muted/30">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{product.vendor}</span>
                            {product.sku && <span>SKU {product.sku}</span>}
                          </div>
                          <h3 className="text-base font-semibold leading-tight">
                            {product.title}
                          </h3>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-lg font-semibold">
                            {formatCurrency(product.price)}
                          </div>
                          <Badge variant={product.available ? "success" : "secondary"}>
                            {product.available ? "In stock" : "Backorder"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="capitalize">
                            {product.category || "General"}
                          </Badge>
                          {product.tags.slice(0, 1).map((tag) => (
                            <Badge key={tag} variant="outline" className="capitalize">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            toast.success(`${product.title} added to quote draft`);
                          }}
                        >
                          Add to quote
                        </Button>
                      </CardContent>
                    </Card>
                  </FadeIn>
                ))}
              </Stagger>
            )}
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card variant="outline" className="space-y-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    Customer snapshot
                  </p>
                  <h3 className="text-xl font-semibold">{customerProfile.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {customerProfile.region}
                  </p>
                </div>
                <Badge variant="success">Preferred</Badge>
              </div>
              <Separator />
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-widest text-foreground/60">Account</p>
                  <p className="text-base text-foreground">{customerProfile.account}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-foreground/60">Contact</p>
                  <p className="text-base text-foreground">{customerProfile.contact}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-foreground/60">Terms</p>
                  <p className="text-base text-foreground">{customerProfile.terms}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-foreground/60">Tier</p>
                  <p className="text-base text-foreground">{customerProfile.tier}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-foreground/60">Credit limit</p>
                  <p className="text-base text-foreground">
                    {formatCurrency(customerProfile.creditLimit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-foreground/60">Open balance</p>
                  <p className="text-base text-foreground">
                    {formatCurrency(customerProfile.balance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-foreground/60">Last order</p>
                  <p className="text-base text-foreground">{customerProfile.lastOrder}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-foreground/60">Sales rep</p>
                  <p className="text-base text-foreground">{customerProfile.rep}</p>
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                Next action: renew 12-month consumables contract and schedule Q4 delivery.
              </div>
              <div className="text-xs text-muted-foreground">
                <div>{customerProfile.email}</div>
                <div>{customerProfile.phone}</div>
              </div>
            </Card>
            <Card variant="glass" className="p-6 lg:sticky lg:top-6">
              {selected ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Selected product</Badge>
                      <Badge variant={summarySource === "jina" ? "success" : "outline"}>
                        {summarySource === "jina" ? "Jina summary" : "Shopify summary"}
                      </Badge>
                    </div>
                    <h3 className="text-2xl font-semibold" data-testid="selected-product-name">
                      {selected.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(selected.price)} AUD
                    </p>
                  </div>

                  {selected.image && (
                    <div className="overflow-hidden rounded-xl border border-white/10">
                      <img
                        src={selected.image}
                        alt={selected.title}
                        className="h-48 w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      <span>Product summary</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSummaryRefresh}
                        disabled={summaryLoading}
                      >
                        {summaryLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        <span className="ml-2">Refresh with Jina</span>
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {summary}
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <Button
                      variant="gradient"
                      onClick={() => toast.success("Quote workflow started")}
                    >
                      Start quote workflow
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => toast.success("Marketing agent notified")}
                    >
                      Send to marketing agent
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a product to preview details and generate AI prompts.
                </p>
              )}
            </Card>

            <Card variant="outline" className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    Quote draft
                  </p>
                  <p className="text-xl font-semibold text-foreground">Line items</p>
                </div>
                <Badge variant="outline">Draft</Badge>
              </div>
              <Separator />
              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">
                      {selected?.title ?? "Select a product to start"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Qty {quoteMetrics.quantity} · {formatCurrency(quoteMetrics.unitPrice)} each
                    </p>
                  </div>
                  <p className="font-semibold text-foreground">
                    {formatCurrency(quoteMetrics.lineTotal)}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Discount ({Math.round(quoteMetrics.discountRate * 100)}%)</span>
                  <span>-{formatCurrency(quoteMetrics.discount)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Shipping (Brisbane)</span>
                  <span>{formatCurrency(quoteMetrics.shipping)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Tax (GST)</span>
                  <span>{formatCurrency(quoteMetrics.tax)}</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Total</span>
                <span>{formatCurrency(quoteMetrics.total)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Delivery window: 3-4 business days · Warehouse: BNE-01
              </div>
            </Card>

            <Card variant="outline" className="space-y-6 p-6" data-testid="pipeline-card">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      Quote → Order pipeline
                    </p>
                    <p
                      className="text-xl font-semibold text-foreground"
                      data-testid="pipeline-stage"
                    >
                      {stageLabels[stage]}
                    </p>
                  </div>
                  <Badge variant="success" className="text-xs">
                    Gemini 3 orchestration
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Edge-ready workflows tap Gemini 3 reasoning with VEO-3.1 content hooks.
                </p>
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-widest text-foreground/60">Quote</p>
                  <p className="font-mono text-base text-foreground">{quoteNumber}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-foreground/60">Order</p>
                  <p className="font-mono text-base text-foreground">{orderNumber}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-foreground/60">Invoice</p>
                  <p className="font-mono text-base text-foreground">{invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-foreground/60">Branch</p>
                  <p className="text-base text-foreground">Brisbane | CCW | Live demo</p>
                </div>
              </div>

              <div className="space-y-4">
                {stageSequence.map((step, index) => {
                  const Icon = stageIconMap[step];
                  const currentIndex = stageSequence.indexOf(stage);
                  const stepIndex = index;
                  const completed = stepIndex < currentIndex;
                  const isCurrent = stepIndex === currentIndex;
                  const timestamp = stageTimestamps[timestampKeyMap[step]];

                  return (
                    <div
                      key={step}
                      className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/30 p-3"
                    >
                      <div
                        className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full ${
                          completed
                            ? "bg-success text-white"
                            : isCurrent
                            ? "bg-primary text-white shadow-lg"
                            : "bg-muted/20 text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p
                          className={`font-medium ${
                            completed || isCurrent
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {stageLabels[step]}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {stageDescriptions[step]}
                          </span>
                        </p>
                        {timestamp && (
                          <p className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
                            {formatTimestamp(timestamp)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-foreground/60">Subtotal</p>
                  <p className="text-base font-semibold text-foreground">
                    {formatCurrency(quoteMetrics.subtotal)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-foreground/60">Tax</p>
                  <p className="text-base font-semibold text-foreground">{formatCurrency(quoteMetrics.tax)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-foreground/60">Total</p>
                  <p className="text-base font-semibold text-foreground">{formatCurrency(quoteMetrics.total)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-foreground/60">Margin</p>
                  <p className="text-base font-semibold text-foreground">
                    {formatCurrency(quoteMetrics.margin)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="gradient"
                  className="flex-1"
                  onClick={handleAdvanceStage}
                  disabled={!selected || stage === "invoice_issued"}
                  data-testid="pipeline-advance"
                >
                  {stageActions[stage]}
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 border border-border text-sm"
                  onClick={handleResetPipeline}
                  disabled={!selected}
                  data-testid="pipeline-reset"
                >
                  Reset pipeline
                </Button>
              </div>
            </Card>

            <Card variant="gradient" className="p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">AI campaign prompt</h3>
                    <p className="text-sm text-white/70">
                      Auto-seeded with the selected product.
                    </p>
                  </div>
                </div>
                <Textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={6}
                  className="bg-white/10 text-white placeholder:text-white/60"
                  placeholder="Select a product to auto-fill this prompt."
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={handleCopyPrompt}
                    disabled={!prompt}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy prompt
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-white/30 text-white hover:bg-white/10"
                  >
                    Launch generation
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value);
}

function generateNumber(prefix: string): string {
  const date = new Date();
  const suffix = String(Math.floor(Math.random() * 900) + 100);
  return `${prefix}-${date.getFullYear()}-${suffix}`;
}
