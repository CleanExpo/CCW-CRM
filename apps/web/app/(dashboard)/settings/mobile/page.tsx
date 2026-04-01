'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Users, CheckCircle, XCircle, Clock, ExternalLink, Camera } from 'lucide-react';
import { mobileApi, type CustomerLink } from '@/lib/api/mobile';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-700' },
  suspended: { label: 'Suspended', className: 'bg-amber-100 text-amber-700' },
  revoked: { label: 'Revoked', className: 'bg-red-100 text-red-700' },
};

export default function MobileSettingsPage() {
  const { toast } = useToast();
  const [links, setLinks] = useState<CustomerLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLinks = useCallback(async () => {
    try {
      const data = await mobileApi.listCustomerLinks();
      setLinks(data);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load customer links',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mobile Ordering</h1>
          <p className="mt-1 text-slate-500">
            Manage customer approval links and photo-to-order settings.
          </p>
        </div>
        <Link
          href="/mobile/order/new"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Camera className="h-4 w-4" />
          New Order
        </Link>
      </div>

      {/* Quick start card */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <h2 className="mb-2 font-semibold text-blue-900">How Photo-to-Order Works</h2>
        <ol className="space-y-2 text-sm text-blue-800">
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
              1
            </span>
            <span>
              Open <strong>New Order</strong> on your phone, point camera at cleaning equipment
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
              2
            </span>
            <span>AI identifies products — review, adjust quantities and prices</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
              3
            </span>
            <span>Enter customer email → they receive a link to approve or decline</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
              4
            </span>
            <span>Customer approves → order is created and payment is collected</span>
          </li>
        </ol>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Active Links',
            value: links.filter((l) => l.status === 'active').length,
            icon: <CheckCircle className="h-5 w-5 text-green-500" />,
          },
          {
            label: 'Suspended',
            value: links.filter((l) => l.status === 'suspended').length,
            icon: <Clock className="h-5 w-5 text-amber-500" />,
          },
          {
            label: 'Total Links',
            value: links.length,
            icon: <Users className="h-5 w-5 text-blue-500" />,
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              {stat.icon}
              <span className="text-sm text-slate-500">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Customer Links table */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Customer Links</h2>
          <button
            className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
            onClick={() =>
              toast({
                title: 'Coming soon',
                description: 'Request customer link feature coming soon',
              })
            }
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </button>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <p className="text-sm text-slate-500">Loading customer links…</p>
          </div>
        ) : links.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <Users className="mx-auto mb-4 h-10 w-10 text-slate-300" />
            <h3 className="mb-1 font-medium text-slate-700">No customer links yet</h3>
            <p className="text-sm text-slate-400">
              Customer links let you create recurring orders for specific customers with preset
              pricing.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {links.map((link) => {
              const badge = STATUS_BADGE[link.status] ?? STATUS_BADGE.active;
              return (
                <div key={link.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-medium text-slate-900">{link.customer_name}</p>
                    <p className="text-sm text-slate-400">{link.customer_email}</p>
                    {link.auto_approve_under != null && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        Auto-approve under ${link.auto_approve_under.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <button
                      className="text-slate-400 hover:text-slate-600"
                      aria-label={`Manage ${link.customer_name}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* PWA Install hint */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="mb-2 font-semibold text-slate-900">Install on Your Phone</h2>
        <p className="mb-3 text-sm text-slate-500">
          For the best experience, install CCW Mobile Order as an app on your phone. It works
          offline and gives you quick access from your home screen.
        </p>
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            <strong>iOS (Safari)</strong>: Tap Share → &ldquo;Add to Home Screen&rdquo;
          </p>
          <p>
            <strong>Android (Chrome)</strong>: Tap menu → &ldquo;Add to Home Screen&rdquo; or
            &ldquo;Install app&rdquo;
          </p>
        </div>
        <Link
          href="/mobile/order/new"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
        >
          Open mobile order page
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </section>
    </div>
  );
}
