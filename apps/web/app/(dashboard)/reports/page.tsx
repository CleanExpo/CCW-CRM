"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText, BarChart2, Users, DollarSign, Package,
  Clock, Download, Play, Plus, Calendar, Check,
  ChevronRight, Trash2, RefreshCw, Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { GlassButton } from "@/components/ui/glass-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Typewriter } from "@/components/ui/typewriter-text";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportCategory = "sales" | "inventory" | "customer" | "financial";

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: ReportCategory;
  estimatedTime: string;
  fields: string[];
  lastRun?: string;
}

interface HistoryItem {
  id: string;
  name: string;
  runAt: string;
  status: "completed" | "running" | "failed";
  size: string;
  format: "CSV" | "PDF";
}

interface ScheduleItem {
  id: string;
  reportName: string;
  frequency: string;
  nextRun: string;
  recipients: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const TEMPLATES: ReportTemplate[] = [
  { id: "sales-product", name: "Sales by Product", description: "Revenue, units sold, and margin per product SKU", category: "sales", estimatedTime: "~15s", fields: ["SKU", "Product Name", "Category", "Units Sold", "Revenue", "Cost", "Margin %"], lastRun: "2 hours ago" },
  { id: "sales-customer", name: "Sales by Customer", description: "Order history and total spend per customer account", category: "sales", estimatedTime: "~12s", fields: ["Customer #", "Company Name", "Total Orders", "Total Spend", "Last Order", "Status"], lastRun: "Yesterday" },
  { id: "sales-period", name: "Sales by Period", description: "Daily, weekly, or monthly revenue breakdown", category: "sales", estimatedTime: "~8s", fields: ["Date", "Orders", "Revenue", "Avg Order Value", "New Customers"], lastRun: "3 days ago" },
  { id: "inv-stock", name: "Stock Levels", description: "Current inventory across all warehouses", category: "inventory", estimatedTime: "~10s", fields: ["SKU", "Product", "Category", "On Hand", "Reorder Point", "Value", "Location"], lastRun: "1 hour ago" },
  { id: "inv-reorder", name: "Reorder Alerts", description: "Products at or below reorder threshold", category: "inventory", estimatedTime: "~6s", fields: ["SKU", "Product", "Current Stock", "Reorder Point", "Supplier", "Lead Time"], lastRun: "4 hours ago" },
  { id: "inv-dead", name: "Dead Stock Report", description: "Products with no sales in last 90 days", category: "inventory", estimatedTime: "~18s", fields: ["SKU", "Product", "Last Sold", "Stock Qty", "Stock Value", "Days Inactive"], lastRun: "1 week ago" },
  { id: "cust-history", name: "Purchase History", description: "Complete order timeline per customer", category: "customer", estimatedTime: "~20s", fields: ["Customer", "Order #", "Date", "Products", "Order Value", "Status", "Salesperson"], lastRun: "2 days ago" },
  { id: "cust-ltv", name: "Customer LTV", description: "Lifetime value and retention analysis", category: "customer", estimatedTime: "~25s", fields: ["Customer", "First Order", "Total Orders", "Total Spend", "Avg Order", "LTV Score"], lastRun: "1 week ago" },
  { id: "fin-pl", name: "P&L Summary", description: "Revenue, COGS, gross margin, and expenses", category: "financial", estimatedTime: "~30s", fields: ["Period", "Revenue", "COGS", "Gross Profit", "Gross Margin %", "Expenses"], lastRun: "Monday" },
  { id: "fin-cashflow", name: "Cash Flow Projection", description: "90-day forward-looking cash flow model", category: "financial", estimatedTime: "~22s", fields: ["Week", "Expected Inflows", "Expected Outflows", "Net Cash", "Cumulative Balance"], lastRun: "Last Friday" },
];

const HISTORY: HistoryItem[] = [
  { id: "h1", name: "Sales by Product", runAt: "16 Mar 2026, 09:14", status: "completed", size: "428 KB", format: "CSV" },
  { id: "h2", name: "Stock Levels", runAt: "16 Mar 2026, 08:30", status: "completed", size: "1.2 MB", format: "PDF" },
  { id: "h3", name: "Reorder Alerts", runAt: "16 Mar 2026, 07:45", status: "completed", size: "84 KB", format: "CSV" },
  { id: "h4", name: "P&L Summary", runAt: "15 Mar 2026, 17:00", status: "completed", size: "216 KB", format: "PDF" },
  { id: "h5", name: "Customer LTV", runAt: "14 Mar 2026, 11:22", status: "failed", size: "—", format: "CSV" },
  { id: "h6", name: "Sales by Period", runAt: "14 Mar 2026, 09:00", status: "completed", size: "312 KB", format: "CSV" },
];

const SCHEDULES: ScheduleItem[] = [
  { id: "s1", reportName: "Stock Levels", frequency: "Daily at 07:00", nextRun: "Tomorrow, 07:00", recipients: "warehouse@ccw.com.au" },
  { id: "s2", reportName: "P&L Summary", frequency: "Weekly (Monday)", nextRun: "23 Mar 2026", recipients: "cfo@ccw.com.au, ceo@ccw.com.au" },
  { id: "s3", reportName: "Reorder Alerts", frequency: "Daily at 06:00", nextRun: "Tomorrow, 06:00", recipients: "purchasing@ccw.com.au" },
];

const BUILDER_FIELDS = [
  "Order Number", "Order Date", "Customer Name", "Customer Email",
  "SKU", "Product Name", "Category", "Quantity", "Unit Price",
  "Line Total", "Order Total", "Order Status", "Salesperson",
  "Payment Status", "Shipping Method", "Ship Date", "Warehouse Location",
  "Stock On Hand", "Reorder Point", "Margin %",
];

const CATEGORY_META: Record<ReportCategory, { icon: React.ElementType; color: string; bg: string }> = {
  sales: { icon: BarChart2, color: "text-blue-600", bg: "bg-blue-500/10" },
  inventory: { icon: Package, color: "text-teal-600", bg: "bg-teal-500/10" },
  customer: { icon: Users, color: "text-purple-600", bg: "bg-purple-500/10" },
  financial: { icon: DollarSign, color: "text-amber-600", bg: "bg-amber-500/10" },
};

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({ template, onRun }: { template: ReportTemplate; onRun: (t: ReportTemplate) => void }) {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_META[template.category];
  const Icon = meta.icon;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-lg ${meta.bg}`}>
            <Icon className={`h-4 w-4 ${meta.color}`} />
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />{template.estimatedTime}
          </div>
        </div>
        <p className="font-semibold text-sm mb-1">{template.name}</p>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{template.description}</p>
        {template.lastRun && <p className="text-[10px] text-muted-foreground mb-2">Last run: {template.lastRun}</p>}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-muted-foreground flex items-center gap-1 mb-3 hover:text-foreground transition-colors"
        >
          <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
          {template.fields.length} fields
        </button>
        {expanded && (
          <div className="flex flex-wrap gap-1 mb-3">
            {template.fields.map((f) => <Badge key={f} variant="secondary" className="text-[10px] px-1.5 py-0">{f}</Badge>)}
          </div>
        )}
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 text-xs" onClick={() => onRun(template)}>
            <Play className="h-3 w-3 mr-1.5" />Run Report
          </Button>
          <Button size="sm" variant="outline" className="text-xs px-2">
            <Download className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("templates");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(["Order Number", "Customer Name", "Order Total", "Order Date", "Order Status"])
  );

  function handleRunReport(t: ReportTemplate) {
    toast({ title: "Report queued", description: `"${t.name}" is generating. You'll be notified when ready.` });
  }

  function toggleField(f: string) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });
  }

  function handleRunCustom() {
    if (selectedFields.size === 0) {
      toast({ title: "No fields selected", description: "Select at least one field.", variant: "destructive" });
      return;
    }
    toast({ title: "Custom report queued", description: `Running with ${selectedFields.size} fields.` });
  }

  const filtered = TEMPLATES.filter((t) => categoryFilter === "all" || t.category === categoryFilter);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row md:items-start md:justify-between gap-4"
      >
        <div className="space-y-2">
          <Badge variant="outline"><FileText className="w-3 h-3 mr-2" />Reports</Badge>
          <h1 className="text-4xl font-semibold tracking-tight">Reports</h1>
          <Typewriter
            text={[
              "10 pre-built templates ready to run",
              "Custom builder with configurable fields",
              "Schedule automated delivery to your inbox",
            ]}
            speed={45} loop deleteSpeed={25} delay={3000}
            className="text-muted-foreground text-base"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />Schedule Report
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule a Report</DialogTitle>
                <DialogDescription>Set up automatic report generation on a recurring schedule.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Report Template</Label>
                  <Select defaultValue="inv-stock">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TEMPLATES.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select defaultValue="daily">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select defaultValue="csv">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sch-email">Recipient Email</Label>
                  <Input id="sch-email" type="email" placeholder="admin@company.com.au" />
                </div>
                <Button className="w-full" onClick={() => { toast({ title: "Schedule saved" }); setScheduleOpen(false); }}>
                  <Check className="h-4 w-4 mr-2" />Save Schedule
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <GlassButton size="sm" contentClassName="flex items-center gap-2" onClick={() => setActiveTab("builder")}>
            <Plus className="w-4 h-4" />Custom Report
          </GlassButton>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="builder">Custom Builder</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Templates */}
          <TabsContent value="templates">
            <div className="space-y-5">
              <div className="flex items-center gap-3 flex-wrap">
                <Filter className="h-4 w-4 text-muted-foreground" />
                {(["all", "sales", "inventory", "customer", "financial"] as const).map((cat) => (
                  <Button key={cat} size="sm" variant={categoryFilter === cat ? "default" : "outline"} onClick={() => setCategoryFilter(cat)} className="capitalize text-xs">
                    {cat === "all" ? "All Reports" : cat}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((t, i) => (
                  <motion.div key={t.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}>
                    <TemplateCard template={t} onRun={handleRunReport} />
                  </motion.div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Builder */}
          <TabsContent value="builder">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Select Fields</CardTitle>
                    <CardDescription>{selectedFields.size} of {BUILDER_FIELDS.length} fields selected</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {BUILDER_FIELDS.map((f) => (
                        <label key={f} className="flex items-center gap-2.5 cursor-pointer group">
                          <Checkbox checked={selectedFields.has(f)} onCheckedChange={() => toggleField(f)} />
                          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{f}</span>
                        </label>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Report Name</Label>
                      <Input placeholder="My Custom Report" />
                    </div>
                    <div className="space-y-2">
                      <Label>Date Range</Label>
                      <Select defaultValue="30d">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7d">Last 7 days</SelectItem>
                          <SelectItem value="30d">Last 30 days</SelectItem>
                          <SelectItem value="90d">Last 90 days</SelectItem>
                          <SelectItem value="12m">Last 12 months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Format</Label>
                      <Select defaultValue="csv">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="csv">CSV</SelectItem>
                          <SelectItem value="pdf">PDF</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" onClick={handleRunCustom}>
                      <Play className="h-4 w-4 mr-2" />Generate Report
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => setScheduleOpen(true)}>
                      <Calendar className="h-4 w-4 mr-2" />Schedule This Report
                    </Button>
                  </CardContent>
                </Card>
                {selectedFields.size > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Selected Fields</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from(selectedFields).map((f) => <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>)}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Scheduled */}
          <TabsContent value="scheduled">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{SCHEDULES.length} active schedules</p>
                <Button size="sm" onClick={() => setScheduleOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />Add Schedule
                </Button>
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Next Run</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {SCHEDULES.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium text-sm">{s.reportName}</TableCell>
                        <TableCell className="text-sm">{s.frequency}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.nextRun}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{s.recipients}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast({ title: "Report triggered", description: `Running "${s.reportName}" now.` })}>
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast({ title: "Schedule removed" })}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* History */}
          <TabsContent value="history">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{HISTORY.length} reports in history</p>
                <Button variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report Name</TableHead>
                      <TableHead>Run At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {HISTORY.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-sm">{item.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.runAt}</TableCell>
                        <TableCell>
                          <Badge variant={item.status === "completed" ? "success" : item.status === "failed" ? "destructive" : "processing"} className="capitalize text-xs">
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{item.format}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.size}</TableCell>
                        <TableCell className="text-right">
                          {item.status === "completed" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast({ title: "Downloading", description: item.name })}>
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {item.status === "failed" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast({ title: "Retrying", description: item.name })}>
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
