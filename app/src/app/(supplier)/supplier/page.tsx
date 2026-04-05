'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api/client';

interface SupplierProfile {
  company_name: string;
  contact_name: string;
  payment_terms: string;
}

interface PurchaseOrder {
  po_id: string;
  po_number: string;
  status: string;
  total: number;
  required_by: string;
  confirmed_delivery_date: string | null;
}

export default function SupplierHomePage() {
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [p, pos] = await Promise.all([
          apiClient.get<SupplierProfile>('/api/supplier-portal/profile'),
          apiClient.get<{ purchase_orders: PurchaseOrder[] }>(
            '/api/supplier-portal/purchase-orders'
          ),
        ]);
        setProfile(p);
        setOrders(pos.purchase_orders);
      } catch {
        /* demo fallback */
      }
    }
    load();
  }, []);

  const pending = orders.filter((o) => o.status === 'pending_confirmation');
  const confirmed = orders.filter((o) => o.status === 'confirmed');
  const totalValue = orders
    .filter((o) => o.status !== 'delivered')
    .reduce((s, o) => s + o.total, 0);

  const STATS = [
    {
      label: 'Pending Confirmation',
      value: pending.length,
      icon: Clock,
      colour: 'text-amber-600 bg-amber-50',
      badge: pending.length > 0 ? 'Action needed' : null,
    },
    {
      label: 'Confirmed Orders',
      value: confirmed.length,
      icon: CheckCircle,
      colour: 'text-green-600 bg-green-50',
      badge: null,
    },
    {
      label: 'Open Order Value',
      value: `$${totalValue.toLocaleString('en-AU', { minimumFractionDigits: 0 })}`,
      icon: DollarSign,
      colour: 'text-blue-600 bg-blue-50',
      badge: null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome{profile ? `, ${profile.contact_name.split(' ')[0]}` : ''}
        </h1>
        {profile && (
          <p className="mt-0.5 text-sm text-slate-500">
            {profile.company_name} · Payment terms: {profile.payment_terms}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className={`rounded-lg p-2 ${stat.colour}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {stat.badge && (
                    <Badge variant="destructive" className="text-xs">
                      {stat.badge}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-sm text-slate-500">{stat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pending action items */}
      {pending.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Awaiting Your Confirmation
          </h2>
          <div className="space-y-2">
            {pending.map((po) => (
              <Link key={po.po_id} href="/supplier/orders">
                <div className="flex cursor-pointer items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 hover:border-amber-300">
                  <div>
                    <p className="text-sm font-semibold text-amber-900">{po.po_number}</p>
                    <p className="text-xs text-amber-700">
                      Required by {new Date(po.required_by).toLocaleDateString('en-AU')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-amber-900">
                      ${po.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-amber-600">Confirm delivery date →</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick link */}
      <Card>
        <CardContent className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 p-2">
              <ShoppingCart className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-medium">All Purchase Orders</p>
              <p className="text-xs text-slate-500">View, confirm, and manage all POs</p>
            </div>
          </div>
          <Link
            href="/supplier/orders"
            className="rounded-md border px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            View All
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
