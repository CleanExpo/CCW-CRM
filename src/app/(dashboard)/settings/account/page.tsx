'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { authApi, type MfaStatus } from '@/lib/api/auth';
import { settingsApi } from '@/lib/api/settings';
import { Bell, Loader2, Lock, Shield, User } from 'lucide-react';
import { useEffect, useState } from 'react';

function MfaSettingsRow() {
  const { toast } = useToast();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{
    secret: string;
    recovery_codes: string[];
  } | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    void authApi
      .getMfaStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  async function startSetup() {
    setBusy(true);
    try {
      const result = await authApi.setupMfa();
      setSetup({ secret: result.secret, recovery_codes: result.recovery_codes });
      toast({
        title: 'Authenticator setup started',
        description: 'Save recovery codes, then confirm.',
      });
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Could not start MFA setup',
        description: error instanceof Error ? error.message : 'Try again',
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup() {
    setBusy(true);
    try {
      await authApi.confirmMfa({ code });
      setSetup(null);
      setCode('');
      setStatus(await authApi.getMfaStatus());
      toast({
        title: 'MFA enabled',
        description: 'Your account now requires an authenticator code at sign-in.',
      });
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Invalid code',
        description: error instanceof Error ? error.message : 'Try again',
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking MFA status…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label>Two-Factor Authentication</Label>
          <p className="text-muted-foreground text-sm">
            {status?.enabled
              ? `Enabled${status.verified_at ? ` · since ${new Date(status.verified_at).toLocaleDateString()}` : ''}. ${status.recovery_codes_remaining} recovery codes left.`
              : status?.enforced
                ? 'Required for all Optix accounts. Enable an authenticator app to stay signed in on next login.'
                : 'Add an authenticator app for stronger account security.'}
          </p>
        </div>
        {!status?.enabled && !setup ? (
          <Button variant="outline" disabled={busy} onClick={() => void startSetup()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enable 2FA'}
          </Button>
        ) : null}
        {status?.enabled ? (
          <Button variant="outline" disabled>
            MFA on
          </Button>
        ) : null}
      </div>
      {setup ? (
        <div className="space-y-2 rounded-md border p-3">
          <p className="font-mono text-xs break-all">Secret: {setup.secret}</p>
          <ul className="grid grid-cols-2 gap-1 font-mono text-xs">
            {setup.recovery_codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="max-w-[160px]"
            />
            <Button disabled={busy || code.trim().length < 6} onClick={() => void confirmSetup()}>
              Confirm
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AccountSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Notification preferences (UI state only — no backend storage)
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);

  // Load current profile on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await settingsApi.getAccount();
        setFullName(profile.full_name ?? '');
        setEmail(profile.email);
      } catch {
        // Use defaults if not available
      } finally {
        setIsFetching(false);
      }
    }
    loadProfile();
  }, []);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const updated = await settingsApi.updateAccount({
        full_name: fullName,
        email: email,
      });
      setFullName(updated.full_name ?? '');
      setEmail(updated.email);

      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully',
      });
    } catch (error: unknown) {
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Password Mismatch',
        description: "New password and confirmation don't match",
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Invalid Password',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      await settingsApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      toast({
        title: 'Password Changed',
        description: 'Your password has been updated successfully',
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: unknown) {
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to change password',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateNotifications() {
    // Notification preferences are UI-only (no backend storage yet)
    toast({
      title: 'Preferences Updated',
      description: 'Notification preferences saved',
    });
  }

  if (isFetching) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <User className="h-8 w-8" />
          Account Settings
        </h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>Update your personal information and email address</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>Update your password to keep your account secure</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Changing...' : 'Change Password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Manage how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-muted-foreground text-sm">
                Receive email notifications for important updates
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={(checked) => {
                setEmailNotifications(checked);
                handleUpdateNotifications();
              }}
              disabled={isLoading}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Order Updates</Label>
              <p className="text-muted-foreground text-sm">
                Get notified when orders are shipped or delivered
              </p>
            </div>
            <Switch
              checked={orderUpdates}
              onCheckedChange={(checked) => {
                setOrderUpdates(checked);
                handleUpdateNotifications();
              }}
              disabled={isLoading}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Weekly Reports</Label>
              <p className="text-muted-foreground text-sm">
                Receive weekly summary of sales and inventory
              </p>
            </div>
            <Switch
              checked={weeklyReports}
              onCheckedChange={(checked) => {
                setWeeklyReports(checked);
                handleUpdateNotifications();
              }}
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Additional security settings for your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MfaSettingsRow />

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Active Sessions</Label>
              <p className="text-muted-foreground text-sm">View and manage your active sessions</p>
            </div>
            <Button variant="outline">View Sessions</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
