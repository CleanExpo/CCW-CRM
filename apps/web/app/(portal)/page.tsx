'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, FileText, Package, Wrench, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api/client';

interface Profile {
  company_name: string;
  contact_name: string;
  account_since: string;
}

interface PortalSummary {
  orders: { total: number; processing: number };
  invoices: { total: number; total_outstanding: number };
  certifications: { expiring_soon_count: number; expired_count: number };
}

export default function PortalHomePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [summary, setSummary] = useState<PortalSummary | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [p, orders, invoices, certs] = await Promise.all([
          apiClient.get<Profile>('/api/portal/profile'),
          apiClient.get<{ total: number; orders: { status: string }[] }>('/api/portal/orders'),
          apiClient.get<{ total: number; total_outstanding: number }>('/api/portal/invoices'),
          apiClient.get<{ expiring_soon_count: number; expired_count: number }>(
            '/api/portal/certifications'
          ),
        ]);
        setProfile(p);
        setSummary({
          orders: {
            total: orders.total,
            processing: orders.orders.filter((o) => o.status === 'processing').length,
          },
          invoices: { total: invoices.total, total_outstanding: invoices.total_outstanding },
          certifications: {
            expiring_soon_count: certs.expiring_soon_count,
            expired_count: certs.expired_count,
          },
        });
      } catch {
        /* silently ignore — demo mode */
      }
    }
    load();
  }, []);

  const QUICK_LINKS = [
    {
      title: 'Order History',
      href: '/portal/orders',
      icon: Package,
      colour: 'text-blue-600 bg-blue-50',
      description: summary ? `${summary.orders.total} orders` : 'View & track orders',
      badge: summary?.orders.processing ? `${summary.orders.processing} active` : null,
      badgeVariant: 'default' as const,
    },
    {
      title: 'Invoices',
      href: '/portal/invoices',
      icon: FileText,
      colour: 'text-green-600 bg-green-50',
      description: summary
        ? `$${summary.invoices.total_outstanding.toLocaleString()} outstanding`
        : 'Download & pay',
      badge: summary?.invoices.total_outstanding ? 'Amount due' : null,
      badgeVariant: 'destructive' as const,
    },
    {
      title: 'Certifications',
      href: '/portal/certifications',
      icon: Award,
      colour: 'text-purple-600 bg-purple-50',
      description: 'IICRC certification status',
      badge: summary?.certifications.expired_count
        ? `${summary.certifications.expired_count} expired`
        : summary?.certifications.expiring_soon_count
          ? `${summary.certifications.expiring_soon_count} expiring soon`
          : null,
      badgeVariant: 'destructive' as const,
    },
    {
      title: 'Service Requests',
      href: '/portal/service',
      icon: Wrench,
      colour: 'text-orange-600 bg-orange-50',
      description: 'Warranty claims & bookings',
      badge: null,
      badgeVariant: 'outline' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back{profile ? `, ${profile.contact_name.split(' ')[0]}` : ''}
        </h1>
        {profile && (
          <p className="mt-0.5 text-sm text-slate-500">
            {profile.company_name} · Customer since {new Date(profile.account_since).getFullYear()}
          </p>
        )}
      </div>

      {/* Alerts */}
      {summary &&
        (summary.certifications.expired_count > 0 ||
          summary.certifications.expiring_soon_count > 0) && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              {summary.certifications.expired_count > 0 && (
                <p>
                  <strong>{summary.certifications.expired_count}</strong> IICRC certification
                  {summary.certifications.expired_count > 1 ? 's have' : ' has'} expired.{' '}
                  <Link href="/portal/certifications" className="underline">
                    Renew now
                  </Link>
                </p>
              )}
              {summary.certifications.expiring_soon_count > 0 && (
                <p>
                  <strong>{summary.certifications.expiring_soon_count}</strong> certification
                  {summary.certifications.expiring_soon_count > 1 ? 's expire' : ' expires'} within
                  60 days.
                </p>
              )}
            </div>
          </div>
        )}

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className={`rounded-lg p-2 ${item.colour}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {item.badge && (
                      <Badge variant={item.badgeVariant} className="text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500">{item.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* CCW contact */}
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
          <div className="text-sm">
            <p className="font-medium text-slate-800">Need help? Contact your CCW rep.</p>
            <p className="text-slate-500">
              Call{' '}
              <a href="tel:1300229266" className="text-blue-600 hover:underline">
                1300 CCW CCW
              </a>{' '}
              or email{' '}
              <a href="mailto:support@ccwonline.com.au" className="text-blue-600 hover:underline">
                support@ccwonline.com.au
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
