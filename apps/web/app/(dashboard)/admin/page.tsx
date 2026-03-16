"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Users, Settings, FileText, Database, Key, Webhook, Plus, Trash2, Download, RefreshCw, Check, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

// Mock data types
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "staff";
  status: "active" | "inactive";
  lastLogin: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  severity: "info" | "warning" | "critical";
  details: string;
}

interface Backup {
  id: string;
  timestamp: string;
  size: string;
  status: "completed" | "failed" | "in_progress";
  type: "manual" | "scheduled";
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
  status: "active" | "revoked";
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  status: "active" | "inactive";
  lastTriggered: string;
}

export default function AdminPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("users");

  // Users state
  const [users, setUsers] = useState<User[]>([
    { id: "1", name: "Admin User", email: "admin@demo.com", role: "admin", status: "active", lastLogin: "2026-03-16 09:30" },
    { id: "2", name: "Sales Manager", email: "sales@demo.com", role: "manager", status: "active", lastLogin: "2026-03-16 08:15" },
    { id: "3", name: "Warehouse Staff", email: "warehouse@demo.com", role: "staff", status: "active", lastLogin: "2026-03-15 16:45" },
  ]);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // System config state
  const [config, setConfig] = useState({
    sessionTimeout: "30",
    maxLoginAttempts: "5",
    passwordExpiry: "90",
    twoFactorEnabled: true,
    emailNotifications: true,
    slackNotifications: false,
    autoBackup: true,
    backupFrequency: "daily",
    backupRetention: "30",
  });

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([
    { id: "1", timestamp: "2026-03-16 10:30", user: "admin@demo.com", action: "User Created", resource: "warehouse@demo.com", severity: "info", details: "New staff account created" },
    { id: "2", timestamp: "2026-03-16 09:15", user: "sales@demo.com", action: "Order Deleted", resource: "ORD-2026-045", severity: "warning", details: "Order cancelled by customer request" },
    { id: "3", timestamp: "2026-03-16 08:00", user: "admin@demo.com", action: "Login Failed", resource: "system", severity: "critical", details: "5 failed login attempts detected" },
  ]);
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  // Backups state
  const [backups, setBackups] = useState<Backup[]>([
    { id: "1", timestamp: "2026-03-16 03:00", size: "2.3 GB", status: "completed", type: "scheduled" },
    { id: "2", timestamp: "2026-03-15 03:00", size: "2.2 GB", status: "completed", type: "scheduled" },
    { id: "3", timestamp: "2026-03-14 15:30", size: "2.1 GB", status: "completed", type: "manual" },
  ]);
  const [showBackupDialog, setShowBackupDialog] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    { id: "1", name: "Production API", key: "sk_live_•••••••••••••••••••••••••", created: "2026-01-15", lastUsed: "2026-03-16 09:45", status: "active" },
    { id: "2", name: "Development API", key: "sk_test_•••••••••••••••••••••••••", created: "2026-02-01", lastUsed: "2026-03-16 10:12", status: "active" },
    { id: "3", name: "Legacy API", key: "sk_live_•••••••••••••••••••••••••", created: "2025-11-20", lastUsed: "2025-12-30", status: "revoked" },
  ]);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([
    { id: "1", url: "https://api.example.com/webhooks/orders", events: ["order.created", "order.updated"], status: "active", lastTriggered: "2026-03-16 10:15" },
    { id: "2", url: "https://api.example.com/webhooks/inventory", events: ["product.stock_low"], status: "active", lastTriggered: "2026-03-15 14:30" },
  ]);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookEndpoint | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);

  // Handlers
  const handleCreateUser = () => {
    setEditingUser(null);
    setShowUserDialog(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowUserDialog(true);
  };

  const handleSaveUser = () => {
    toast({
      title: "Success",
      description: editingUser ? "User updated successfully" : "User created successfully",
    });
    setShowUserDialog(false);
    setEditingUser(null);
  };

  const handleDeleteUser = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      setDeleteTarget({ type: "user", id: userId, name: user.name });
    }
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      if (deleteTarget.type === "user") {
        setUsers(users.filter((u) => u.id !== deleteTarget.id));
      } else if (deleteTarget.type === "apiKey") {
        setApiKeys(apiKeys.filter((k) => k.id !== deleteTarget.id));
      } else if (deleteTarget.type === "webhook") {
        setWebhooks(webhooks.filter((w) => w.id !== deleteTarget.id));
      }
      toast({
        title: "Deleted",
        description: `${deleteTarget.type} deleted successfully`,
      });
    }
    setDeleteTarget(null);
  };

  const handleSaveConfig = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({
        title: "Settings Saved",
        description: "System configuration updated successfully",
      });
    }, 1000);
  };

  const handleCreateBackup = () => {
    setShowBackupDialog(false);
    const newBackup: Backup = {
      id: String(backups.length + 1),
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 16),
      size: "2.4 GB",
      status: "in_progress",
      type: "manual",
    };
    setBackups([newBackup, ...backups]);

    setTimeout(() => {
      setBackups((prev) =>
        prev.map((b) => (b.id === newBackup.id ? { ...b, status: "completed" as const } : b))
      );
      toast({
        title: "Backup Complete",
        description: "Database backup created successfully",
      });
    }, 3000);
  };

  const handleGenerateApiKey = () => {
    const key = `sk_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    setGeneratedKey(key);

    const newKey: ApiKey = {
      id: String(apiKeys.length + 1),
      name: newApiKeyName,
      key: key.slice(0, 10) + "•".repeat(24),
      created: new Date().toISOString().slice(0, 10),
      lastUsed: "Never",
      status: "active",
    };
    setApiKeys([newKey, ...apiKeys]);
    setNewApiKeyName("");
  };

  const handleRevokeApiKey = (keyId: string) => {
    const key = apiKeys.find((k) => k.id === keyId);
    if (key) {
      setDeleteTarget({ type: "apiKey", id: keyId, name: key.name });
    }
  };

  const handleCreateWebhook = () => {
    setEditingWebhook(null);
    setShowWebhookDialog(true);
  };

  const handleEditWebhook = (webhook: WebhookEndpoint) => {
    setEditingWebhook(webhook);
    setShowWebhookDialog(true);
  };

  const handleSaveWebhook = () => {
    toast({
      title: "Success",
      description: editingWebhook ? "Webhook updated successfully" : "Webhook created successfully",
    });
    setShowWebhookDialog(false);
    setEditingWebhook(null);
  };

  const handleDeleteWebhook = (webhookId: string) => {
    const webhook = webhooks.find((w) => w.id === webhookId);
    if (webhook) {
      setDeleteTarget({ type: "webhook", id: webhookId, name: webhook.url });
    }
  };

  const filteredAuditLogs = severityFilter === "all"
    ? auditLogs
    : auditLogs.filter((log) => log.severity === severityFilter);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500";
      case "warning":
        return "bg-yellow-500";
      default:
        return "bg-blue-500";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "completed":
        return "bg-green-500";
      case "inactive":
      case "revoked":
        return "bg-gray-500";
      case "failed":
        return "bg-red-500";
      case "in_progress":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">System Administration</h1>
              <p className="text-muted-foreground">Manage users, configuration, security, and system health</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Audit Log</span>
            </TabsTrigger>
            <TabsTrigger value="backups" className="gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Backups</span>
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="gap-2">
              <Key className="h-4 w-4" />
              <span className="hidden sm:inline">API Keys</span>
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook className="h-4 w-4" />
              <span className="hidden sm:inline">Webhooks</span>
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Manage user accounts and permissions</CardDescription>
                  </div>
                  <Button onClick={handleCreateUser}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(user.status)}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.lastLogin}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={user.role === "admin"}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Security Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>Configure authentication and access control</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                    <Input
                      id="session-timeout"
                      type="number"
                      value={config.sessionTimeout}
                      onChange={(e) => setConfig({ ...config, sessionTimeout: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-login">Max Login Attempts</Label>
                    <Input
                      id="max-login"
                      type="number"
                      value={config.maxLoginAttempts}
                      onChange={(e) => setConfig({ ...config, maxLoginAttempts: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-expiry">Password Expiry (days)</Label>
                    <Input
                      id="password-expiry"
                      type="number"
                      value={config.passwordExpiry}
                      onChange={(e) => setConfig({ ...config, passwordExpiry: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="two-factor">Two-Factor Authentication</Label>
                    <Switch
                      id="two-factor"
                      checked={config.twoFactorEnabled}
                      onCheckedChange={(checked) => setConfig({ ...config, twoFactorEnabled: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Notification Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Notification Settings</CardTitle>
                  <CardDescription>Configure alert channels and preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email-notif">Email Notifications</Label>
                    <Switch
                      id="email-notif"
                      checked={config.emailNotifications}
                      onCheckedChange={(checked) => setConfig({ ...config, emailNotifications: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="slack-notif">Slack Notifications</Label>
                    <Switch
                      id="slack-notif"
                      checked={config.slackNotifications}
                      onCheckedChange={(checked) => setConfig({ ...config, slackNotifications: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Backup Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Backup Settings</CardTitle>
                  <CardDescription>Configure automated database backups</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-backup">Automatic Backups</Label>
                    <Switch
                      id="auto-backup"
                      checked={config.autoBackup}
                      onCheckedChange={(checked) => setConfig({ ...config, autoBackup: checked })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backup-freq">Backup Frequency</Label>
                    <Select
                      value={config.backupFrequency}
                      onValueChange={(value) => setConfig({ ...config, backupFrequency: value })}
                    >
                      <SelectTrigger id="backup-freq">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backup-retention">Retention Period (days)</Label>
                    <Input
                      id="backup-retention"
                      type="number"
                      value={config.backupRetention}
                      onChange={(e) => setConfig({ ...config, backupRetention: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveConfig} disabled={loading}>
                {loading ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Audit Log</CardTitle>
                    <CardDescription>System activity and security events</CardDescription>
                  </div>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severities</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAuditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.timestamp}</TableCell>
                        <TableCell className="font-medium">{log.user}</TableCell>
                        <TableCell>{log.action}</TableCell>
                        <TableCell>{log.resource}</TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(log.severity)}>
                            {log.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md truncate">{log.details}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Backups Tab */}
          <TabsContent value="backups" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Database Backups</CardTitle>
                    <CardDescription>Backup history and restoration</CardDescription>
                  </div>
                  <Button onClick={() => setShowBackupDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Backup
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backups.map((backup) => (
                      <TableRow key={backup.id}>
                        <TableCell className="font-medium">{backup.timestamp}</TableCell>
                        <TableCell>{backup.size}</TableCell>
                        <TableCell>
                          <Badge variant={backup.type === "manual" ? "default" : "secondary"}>
                            {backup.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(backup.status)}>
                            {backup.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="sm" disabled={backup.status !== "completed"}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                          <Button variant="ghost" size="sm" disabled={backup.status !== "completed"}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Restore
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Keys</CardTitle>
                    <CardDescription>Manage API authentication keys</CardDescription>
                  </div>
                  <Button onClick={() => setShowApiKeyDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Generate Key
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell className="font-mono text-sm">{key.key}</TableCell>
                        <TableCell>{key.created}</TableCell>
                        <TableCell>{key.lastUsed}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(key.status)}>
                            {key.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeApiKey(key.id)}
                            disabled={key.status === "revoked"}
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Webhook Endpoints</CardTitle>
                    <CardDescription>Configure event notifications</CardDescription>
                  </div>
                  <Button onClick={handleCreateWebhook}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Webhook
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead>Events</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Triggered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooks.map((webhook) => (
                      <TableRow key={webhook.id}>
                        <TableCell className="font-mono text-sm max-w-xs truncate">
                          {webhook.url}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {webhook.events.map((event) => (
                              <Badge key={event} variant="outline" className="text-xs">
                                {event}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(webhook.status)}>
                            {webhook.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{webhook.lastTriggered}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditWebhook(webhook)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteWebhook(webhook.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Backup Confirmation Dialog */}
      <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Database Backup</DialogTitle>
            <DialogDescription>
              This will create a full backup of the database. The process may take several minutes depending on database size.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBackupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBackup}>Create Backup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Key Generation Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
            <DialogDescription>
              {generatedKey
                ? "Your API key has been generated. Copy it now - you won't be able to see it again."
                : "Enter a name for the API key to help identify its purpose."}
            </DialogDescription>
          </DialogHeader>
          {generatedKey ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 font-mono text-sm break-all">
                {generatedKey}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                <span>Store this key securely. It will not be shown again.</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-name">Key Name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g., Production API Key"
                  value={newApiKeyName}
                  onChange={(e) => setNewApiKeyName(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            {generatedKey ? (
              <Button onClick={() => {
                setGeneratedKey(null);
                setShowApiKeyDialog(false);
              }}>
                Done
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowApiKeyDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGenerateApiKey} disabled={!newApiKeyName.trim()}>
                  Generate
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
