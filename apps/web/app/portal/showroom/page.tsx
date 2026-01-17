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
import { Label } from "@/components/ui/label";
import { FadeIn, Stagger } from "@/components/ui/motion";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trackTelemetry } from "@/lib/telemetry";
import { apiClient } from "@/lib/api/client";
import { formatCurrency } from "@/lib/utils/calculations";
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
  X,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
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

interface BackendCustomer {
  id: string;
  customer_number: string;
  company_name: string;
  email?: string;
}

interface BackendProduct {
  id: string;
  sku: string;
  name: string;
}

interface BackendOrderResponse {
  id: string;
  order_number: string;
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

interface DemoOrder {
  id: string;
  orderNumber: string;
  invoiceNumber: string;
  createdAt: string;
  customerName: string;
  customerAccount: string;
  customerEmail: string;
  customerPhone: string;
  lineItems: Array<{
    title: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
}

interface QuoteItem {
  id: string;
  sku: string;
  title: string;
  unitPrice: number;
  quantity: number;
  available: boolean;
  category: string;
}

interface AuditNote {
  id: string;
  timestamp: string;
  message: string;
  actor: string;
}

export default function CcwShowroomPage() {
  const router = useRouter();
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
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [quoteDiscountPercent, setQuoteDiscountPercent] = useState(0);
  const [quoteShipping, setQuoteShipping] = useState(0);
  const [quoteGstEnabled, setQuoteGstEnabled] = useState(true);
  const [auditNotes, setAuditNotes] = useState<AuditNote[]>([]);
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
  const [demoOrder, setDemoOrder] = useState<DemoOrder | null>(null);
  const [isOrderCreating, setIsOrderCreating] = useState(false);
  const hasTrackedVisit = useRef(false);
  const hasQuoteSeeded = useRef(false);

  useEffect(() => {
    setQuoteNumber(generateNumber("Q"));
    setOrderNumber(generateNumber("ORD"));
    setInvoiceNumber(generateNumber("INV"));
  }, []);

  useEffect(() => {
    if (hasTrackedVisit.current) return;
    hasTrackedVisit.current = true;
    void trackTelemetry({
      name: "showroom_visit",
      metadata: { surface: "portal_showroom" },
    });
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
        const firstProduct = data.products?.[0] ?? null;
        setSelected(firstProduct);
        if (firstProduct) {
          const initialQuantity = 24;
          const baseLineTotal = firstProduct.price * initialQuantity;
          const suggestedDiscountRate =
            firstProduct.compareAtPrice && firstProduct.compareAtPrice > firstProduct.price
              ? Math.min((firstProduct.compareAtPrice - firstProduct.price) / firstProduct.compareAtPrice, 0.15)
              : 0.08;

          setQuoteItems([createQuoteItem(firstProduct, initialQuantity)]);
          setQuoteDiscountPercent(Math.round(suggestedDiscountRate * 100));
          setQuoteShipping(baseLineTotal > 0 ? (baseLineTotal > 1200 ? 0 : 45) : 0);
          setQuoteGstEnabled(true);
        } else {
          setQuoteItems([]);
        }
        setError(null);
        if (firstProduct) {
          void trackTelemetry({
            name: "showroom_product_selected",
            metadata: {
              productId: firstProduct.id,
              title: firstProduct.title,
              source: "auto",
            },
          });
        }
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

  const resetQuoteWorkflow = useCallback(() => {
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
    setDemoOrder(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("ccw_showroom_order");
    }
  }, []);

  useEffect(() => {
    if (!quoteItems.length) {
      if (hasQuoteSeeded.current) {
        resetQuoteWorkflow();
        setAuditNotes([]);
      }
      return;
    }
    hasQuoteSeeded.current = true;
    resetQuoteWorkflow();
    setAuditNotes([]);
  }, [quoteItems, resetQuoteWorkflow]);

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
    const discountPercent = clampNumber(quoteDiscountPercent, 0, 25);
    const discountRate = discountPercent / 100;
    const lineSubtotal = quoteItems.reduce((sum, item) => {
      return sum + item.unitPrice * item.quantity;
    }, 0);
    const discount = lineSubtotal * discountRate;
    const shipping = Math.max(0, quoteShipping);
    const subtotal = Math.max(lineSubtotal - discount + shipping, 0);
    const tax = quoteGstEnabled ? subtotal * 0.1 : 0;
    const total = subtotal + tax;
    const cost = lineSubtotal * 0.6;
    const margin = subtotal - cost;
    const marginRate = subtotal > 0 ? (margin / subtotal) * 100 : 0;
    const itemCount = quoteItems.reduce((sum, item) => sum + item.quantity, 0);
    return {
      lineSubtotal,
      discountPercent,
      discountRate,
      discount,
      shipping,
      subtotal,
      tax,
      total,
      margin,
      marginRate,
      itemCount,
    };
  }, [quoteDiscountPercent, quoteGstEnabled, quoteItems, quoteShipping]);

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
  const creditUsage = customerProfile.creditLimit
    ? Math.min((customerProfile.balance / customerProfile.creditLimit) * 100, 100)
    : 0;

  const stageSequence: PipelineStage[] = [
    "quote_prepared",
    "quote_sent",
    "order_confirmed",
    "invoice_issued",
  ];
  const hasQuoteItems = quoteItems.length > 0;
  const isOrderReady =
    hasQuoteItems &&
    stageSequence.indexOf(stage) >= stageSequence.indexOf("order_confirmed");

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

  const handleAddToQuote = (product: CcwProduct) => {
    const isFirstItem = quoteItems.length === 0;
    setQuoteItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, createQuoteItem(product, 1)];
    });
    if (isFirstItem) {
      const baseLineTotal = product.price;
      const suggestedDiscountRate =
        product.compareAtPrice && product.compareAtPrice > product.price
          ? Math.min((product.compareAtPrice - product.price) / product.compareAtPrice, 0.15)
          : 0.08;

      setQuoteDiscountPercent(Math.round(suggestedDiscountRate * 100));
      setQuoteShipping(baseLineTotal > 0 ? (baseLineTotal > 1200 ? 0 : 45) : 0);
      setQuoteGstEnabled(true);
    }
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    const nextQuantity = Math.max(0, Math.floor(quantity));
    setQuoteItems((prev) => {
      if (nextQuantity === 0) {
        return prev.filter((item) => item.id !== productId);
      }
      return prev.map((item) =>
        item.id === productId ? { ...item, quantity: nextQuantity } : item
      );
    });
  };

  const handleRemoveItem = (productId: string) => {
    setQuoteItems((prev) => prev.filter((item) => item.id !== productId));
  };

  const handleClearQuote = () => {
    setQuoteItems([]);
  };

  const handleAdvanceStage = () => {
    if (!quoteItems.length) {
      toast.error("Add at least one line item before advancing the workflow.");
      return;
    }

    const previousStage = stage;
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
    setAuditNotes((prev) => [
      ...prev,
      {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: now,
        message: `${stageLabels[nextStage]} recorded`,
        actor: "Workflow engine",
      },
    ]);
    void trackTelemetry({
      name: "showroom_pipeline_advance",
      metadata: {
        from: previousStage,
        to: nextStage,
        itemCount: quoteItems.length,
      },
    });
    toast.success(`${stageLabels[nextStage]} recorded`);
  };

  const handleResetPipeline = () => {
    resetQuoteWorkflow();
    setAuditNotes((prev) => [
      ...prev,
      {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: new Date().toISOString(),
        message: "Pipeline reset to quote prepared",
        actor: "Sales operator",
      },
    ]);
    void trackTelemetry({
      name: "showroom_pipeline_reset",
      metadata: {
        itemCount: quoteItems.length,
      },
    });
  };

  const handleCopyPrompt = async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    void trackTelemetry({
      name: "showroom_prompt_copied",
      metadata: {
        productId: selected?.id ?? null,
        title: selected?.title ?? null,
      },
    });
    toast.success("Prompt copied to clipboard");
  };

  const handleSummaryRefresh = async () => {
    if (!selected) return;
    setSummaryLoading(true);
    void trackTelemetry({
      name: "showroom_summary_refresh",
      metadata: {
        productId: selected.id,
        title: selected.title,
        status: "start",
      },
    });
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
        void trackTelemetry({
          name: "showroom_summary_refresh",
          metadata: {
            productId: selected.id,
            title: selected.title,
            status: "success",
          },
        });
      } else {
        void trackTelemetry({
          name: "showroom_summary_refresh",
          metadata: {
            productId: selected.id,
            title: selected.title,
            status: "empty",
          },
        });
        toast.error("No summary returned from Jina");
      }
    } catch (err) {
      void trackTelemetry({
        name: "showroom_summary_refresh",
        metadata: {
          productId: selected.id,
          title: selected.title,
          status: "error",
        },
      });
      toast.error(err instanceof Error ? err.message : "Unable to load summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!quoteItems.length) {
      toast.error("Add at least one line item before creating an order.");
      return;
    }
    if (!isOrderReady) {
      toast.error("Advance the pipeline to order confirmed before creating an order.");
      return;
    }
    if (demoOrder) {
      toast.success("Order already created for this quote.");
      return;
    }

    setIsOrderCreating(true);

    try {
      const resolveCustomerId = async () => {
        const searchKey = customerProfile.account || customerProfile.name;
        const lookup = await apiClient.get<{ items: BackendCustomer[] }>(
          `/api/customers?search=${encodeURIComponent(searchKey)}&page_size=5`
        );
        const match =
          lookup.items?.find((customer) =>
            customer.customer_number === customerProfile.account ||
            customer.company_name === customerProfile.name ||
            customer.email === customerProfile.email
          ) ?? lookup.items?.[0];

        if (match) {
          return match.id;
        }

        const [city, state] = customerProfile.region
          .split(",")
          .map((value) => value.trim());
        const customerPayload = {
          customer_number: customerProfile.account || `CUST-${Date.now()}`,
          company_name: customerProfile.name,
          contact_name: customerProfile.contact,
          email: customerProfile.email,
          phone: customerProfile.phone,
          city: city || undefined,
          state: state || undefined,
        };
        const created = await apiClient.post<BackendCustomer>(
          "/api/customers",
          customerPayload
        );
        return created.id;
      };

      const resolveProductId = async (item: QuoteItem) => {
        const searchKey = item.sku || item.title;
        const lookup = await apiClient.get<{ items: BackendProduct[] }>(
          `/api/products?search=${encodeURIComponent(searchKey)}&page_size=5`
        );
        const match =
          lookup.items?.find((product) =>
            item.sku ? product.sku === item.sku : product.name === item.title
          ) ?? lookup.items?.[0];

        if (match) {
          return match.id;
        }

        const sourceProduct = products.find((product) => product.id === item.id);
        const productPayload = {
          sku: item.sku || `CCW-${item.id}`,
          name: item.title,
          description: sourceProduct?.description ?? "",
          category: sourceProduct?.category ?? "Uncategorized",
          price: item.unitPrice,
          cost: Number((item.unitPrice * 0.6).toFixed(2)),
          stock: Math.max(item.quantity * 2, 5),
          warehouse_location: "BNE-01",
        };
        const created = await apiClient.post<BackendProduct>(
          "/api/products",
          productPayload
        );
        return created.id;
      };

      const customerId = await resolveCustomerId();
      const resolvedItems: Array<{ product_id: string; quantity: number }> = [];

      for (const item of quoteItems) {
        const productId = await resolveProductId(item);
        resolvedItems.push({
          product_id: productId,
          quantity: item.quantity,
        });
      }

      const orderNotes = [
        `Showroom demo order from ${quoteNumber}.`,
        `Discount: ${quoteMetrics.discountPercent}%`,
        `Shipping: ${formatCurrency(quoteMetrics.shipping)}`,
        `GST: ${quoteGstEnabled ? "enabled" : "exempt"}`,
      ].join("\n");

      const orderPayload = {
        customer_id: customerId,
        status: "pending",
        fulfillment_location: "brisbane",
        notes: orderNotes,
        items: resolvedItems,
      };

      const response = await apiClient.post<BackendOrderResponse>(
        "/api/orders",
        orderPayload
      );

      const resolvedOrderNumber = response.order_number || orderNumber;
      setOrderNumber(resolvedOrderNumber);

      const newOrder: DemoOrder = {
        id: response.id,
        orderNumber: resolvedOrderNumber,
        invoiceNumber,
        createdAt: new Date().toISOString(),
        customerName: customerProfile.name,
        customerAccount: customerProfile.account,
        customerEmail: customerProfile.email,
        customerPhone: customerProfile.phone,
        lineItems: quoteItems.map((item) => ({
          title: item.title,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.unitPrice * item.quantity,
        })),
        subtotal: quoteMetrics.subtotal,
        discount: quoteMetrics.discount,
        shipping: quoteMetrics.shipping,
        tax: quoteMetrics.tax,
        total: quoteMetrics.total,
      };

      setDemoOrder(newOrder);
      sessionStorage.setItem("ccw_showroom_order", JSON.stringify(newOrder));
      void trackTelemetry({
        name: "showroom_order_created",
        metadata: {
          orderNumber: newOrder.orderNumber,
          itemCount: quoteItems.length,
          backendOrderId: response.id,
        },
      });
      toast.success("Order created and ready for invoice export.");
    } catch (err) {
      console.error("Order creation failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to create order.");
    } finally {
      setIsOrderCreating(false);
    }
  };

  const handleViewInvoice = () => {
    if (!demoOrder) {
      toast.error("Create an order before viewing the invoice.");
      return;
    }
    void trackTelemetry({
      name: "showroom_invoice_opened",
      metadata: { orderNumber: demoOrder.orderNumber },
    });
    router.push("/portal/showroom/invoice");
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
                void trackTelemetry({
                  name: "showroom_share_link",
                  metadata: { url: window.location.href },
                });
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
                      onClick={() => {
                        setSelected(product);
                        void trackTelemetry({
                          name: "showroom_product_selected",
                          metadata: {
                            productId: product.id,
                            title: product.title,
                            source: "user",
                          },
                        });
                      }}
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
                            handleAddToQuote(product);
                            void trackTelemetry({
                              name: "showroom_product_added",
                              metadata: {
                                productId: product.id,
                                title: product.title,
                              },
                            });
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
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between text-xs uppercase tracking-widest text-foreground/60">
                  <span>Credit usage</span>
                  <span>{Math.round(creditUsage)}%</span>
                </div>
                <Progress value={creditUsage} />
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                Next action: renew 12-month consumables contract and schedule Q4 delivery.
              </div>
              <div className="text-xs text-muted-foreground">
                <div>{customerProfile.email}</div>
                <div>{customerProfile.phone}</div>
              </div>
            </Card>
            <Card variant="glass" className="p-6">
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
                    <div className="relative h-48 w-full overflow-hidden rounded-xl border border-white/10">
                      <Image
                        src={selected.image}
                        alt={selected.title}
                        fill
                        sizes="(max-width: 1024px) 100vw, 360px"
                        className="object-cover"
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
                    <p
                      className="text-sm text-muted-foreground leading-relaxed"
                      data-testid="summary-text"
                    >
                      {summary}
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <Button
                      variant="gradient"
                      onClick={() => {
                        void trackTelemetry({
                          name: "showroom_quote_start",
                          metadata: {
                            productId: selected.id,
                            title: selected.title,
                          },
                        });
                        toast.success("Quote workflow started");
                      }}
                    >
                      Start quote workflow
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        void trackTelemetry({
                          name: "showroom_marketing_notify",
                          metadata: {
                            productId: selected.id,
                            title: selected.title,
                          },
                        });
                        toast.success("Marketing agent notified");
                      }}
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
                <Badge variant="outline" data-testid="quote-item-count">
                  {quoteItems.length ? `${quoteItems.length} items` : "Draft"}
                </Badge>
              </div>
              <Separator />
              {quoteItems.length ? (
                <div className="space-y-3 text-sm">
                  {quoteItems.map((item) => (
                    <div
                      key={item.id}
                      data-testid="quote-item"
                      className="rounded-lg border border-border/60 bg-muted/10 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{item.title}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {item.sku && <span>SKU {item.sku}</span>}
                            <span>{formatCurrency(item.unitPrice)} each</span>
                            <Badge variant={item.available ? "success" : "secondary"}>
                              {item.available ? "In stock" : "Backorder"}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Remove item</span>
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor={`quote-qty-${item.id}`}
                            className="text-[10px] uppercase tracking-widest text-muted-foreground"
                          >
                            Qty
                          </Label>
                          <Input
                            id={`quote-qty-${item.id}`}
                            type="number"
                            min={0}
                            step={1}
                            value={item.quantity}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              handleUpdateQuantity(item.id, Number.isFinite(value) ? value : 0);
                            }}
                            className="h-9 w-20 bg-background/70"
                          />
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                  No line items yet. Use "Add to quote" to build the draft.
                </div>
              )}
              <div className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs sm:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="quote-discount"
                    className="text-[10px] uppercase tracking-widest text-muted-foreground"
                  >
                    Discount %
                  </Label>
                  <Input
                    id="quote-discount"
                    type="number"
                    min={0}
                    max={25}
                    step={0.5}
                    value={quoteDiscountPercent}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setQuoteDiscountPercent(Number.isFinite(value) ? clampNumber(value, 0, 25) : 0);
                    }}
                    className="h-9 bg-background/70"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="quote-shipping"
                    className="text-[10px] uppercase tracking-widest text-muted-foreground"
                  >
                    Shipping (AUD)
                  </Label>
                  <Input
                    id="quote-shipping"
                    type="number"
                    min={0}
                    step={1}
                    value={quoteShipping}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setQuoteShipping(Number.isFinite(value) ? Math.max(0, value) : 0);
                    }}
                    className="h-9 bg-background/70"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-foreground/60">GST</p>
                  <p className="text-[11px] text-muted-foreground">
                    Toggle for GST-exempt accounts
                  </p>
                </div>
                <Switch checked={quoteGstEnabled} onCheckedChange={setQuoteGstEnabled} />
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Discount ({quoteMetrics.discountPercent}%)</span>
                  <span>-{formatCurrency(quoteMetrics.discount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Shipping (Brisbane)</span>
                  <span>{formatCurrency(quoteMetrics.shipping)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{quoteGstEnabled ? "GST (10%)" : "GST (exempt)"}</span>
                  <span>{formatCurrency(quoteMetrics.tax)}</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Total</span>
                <span>{formatCurrency(quoteMetrics.total)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{quoteMetrics.itemCount} items in draft</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearQuote}
                  disabled={!quoteItems.length}
                >
                  Clear quote
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Delivery window: 3-4 business days | Warehouse: BNE-01
              </div>
            </Card>

            <Card variant="outline" className="space-y-6 p-6" data-testid="pipeline-card">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      Quote to order pipeline
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

              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  <span>Audit notes</span>
                  <span>{auditNotes.length} events</span>
                </div>
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  {auditNotes.length ? (
                    auditNotes.slice(-3).map((note) => (
                      <div key={note.id} className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-foreground">{note.message}</p>
                          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                            {note.actor}
                          </p>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                          {formatTimestamp(note.timestamp)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p>Notes appear as workflow stages advance.</p>
                  )}
                </div>
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
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-foreground/60">Margin %</p>
                  <p className="text-base font-semibold text-foreground">
                    {quoteMetrics.marginRate.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="gradient"
                  className="flex-1"
                  onClick={handleAdvanceStage}
                  disabled={!hasQuoteItems || stage === "invoice_issued"}
                  data-testid="pipeline-advance"
                >
                  {stageActions[stage]}
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 border border-border text-sm"
                  onClick={handleResetPipeline}
                  disabled={!hasQuoteItems}
                  data-testid="pipeline-reset"
                >
                  Reset pipeline
                </Button>
              </div>
            </Card>

            <Card variant="outline" className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    Order to cash
                  </p>
                  <p className="text-xl font-semibold text-foreground">Order actions</p>
                </div>
                <Badge variant={demoOrder ? "success" : "outline"}>
                  {demoOrder ? "Order created" : "Draft"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Create the order once the pipeline is confirmed, then export the invoice for
                accounts.
              </p>
              {demoOrder ? (
                <div className="grid gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Order number</span>
                    <span className="font-mono text-foreground">{demoOrder.orderNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Invoice number</span>
                    <span className="font-mono text-foreground">{demoOrder.invoiceNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Line items</span>
                    <span className="font-semibold text-foreground">
                      {demoOrder.lineItems.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(demoOrder.total)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                  Pipeline must reach order confirmed before creating the order.
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="gradient"
                  onClick={handleCreateOrder}
                  disabled={
                    !hasQuoteItems ||
                    !isOrderReady ||
                    Boolean(demoOrder) ||
                    isOrderCreating
                  }
                >
                  {isOrderCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating order...
                    </>
                  ) : (
                    "Create order"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleViewInvoice}
                  disabled={!demoOrder}
                >
                  View invoice
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

function generateNumber(prefix: string): string {
  const date = new Date();
  const suffix = String(Math.floor(Math.random() * 900) + 100);
  return `${prefix}-${date.getFullYear()}-${suffix}`;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function createQuoteItem(product: CcwProduct, quantity: number): QuoteItem {
  return {
    id: product.id,
    sku: product.sku,
    title: product.title,
    unitPrice: product.price,
    quantity: Math.max(0, Math.floor(quantity)),
    available: product.available,
    category: product.category,
  };
}
