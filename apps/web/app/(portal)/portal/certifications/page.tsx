'use client';

import { useEffect, useState } from 'react';
import { Award, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api/client';

interface Certification {
  cert_id: string;
  cert_type: string;
  full_name: string;
  cert_number: string;
  issued_date: string;
  expiry_date: string;
  status: string;
  days_until_expiry: number;
}

interface CertsResponse {
  total: number;
  active_count: number;
  expired_count: number;
  expiring_soon_count: number;
  certifications: Certification[];
}

function CertStatusBadge({ cert }: { cert: Certification }) {
  if (cert.status === 'expired') {
    return (
      <Badge variant="destructive" className="flex w-fit items-center gap-1">
        <XCircle className="h-3 w-3" /> Expired
      </Badge>
    );
  }
  if (cert.days_until_expiry <= 60) {
    return (
      <Badge className="flex w-fit items-center gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
        <AlertTriangle className="h-3 w-3" /> Expiring soon
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="flex w-fit items-center gap-1">
      <CheckCircle className="h-3 w-3" /> Active
    </Badge>
  );
}

export default function PortalCertificationsPage() {
  const [data, setData] = useState<CertsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiClient.get<CertsResponse>('/api/portal/certifications');
        setData(res);
      } catch {
        /* demo fallback */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-slate-400">Loading…</div>;
  }

  const certs = data?.certifications ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">IICRC Certifications</h1>
        <p className="mt-0.5 text-sm text-slate-500">Certification status for your technicians</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-slate-500">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{data?.active_count ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-slate-500">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{data?.expiring_soon_count ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-slate-500">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{data?.expired_count ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cert cards */}
      <div className="space-y-3">
        {certs.map((cert) => (
          <Card key={cert.cert_id}>
            <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-lg p-2 ${cert.status === 'expired' ? 'bg-red-50' : cert.days_until_expiry <= 60 ? 'bg-amber-50' : 'bg-green-50'}`}
                >
                  <Award
                    className={`h-5 w-5 ${cert.status === 'expired' ? 'text-red-500' : cert.days_until_expiry <= 60 ? 'text-amber-500' : 'text-green-500'}`}
                  />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{cert.cert_type}</p>
                  <p className="text-sm text-slate-500">{cert.full_name}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">{cert.cert_number}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <CertStatusBadge cert={cert} />
                <div className="text-right text-xs text-slate-500">
                  <p>Issued: {new Date(cert.issued_date).toLocaleDateString('en-AU')}</p>
                  <p>Expires: {new Date(cert.expiry_date).toLocaleDateString('en-AU')}</p>
                  {cert.status === 'active' && cert.days_until_expiry > 0 && (
                    <p className={cert.days_until_expiry <= 60 ? 'font-medium text-amber-600' : ''}>
                      {cert.days_until_expiry} days remaining
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {certs.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Award className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-slate-500">No certifications on file</p>
              <p className="mt-1 text-xs text-slate-400">
                Contact CCW to register your IICRC certifications.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* IICRC info */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">About IICRC Certifications</p>
        <p className="mt-1 text-xs text-blue-700">
          IICRC certifications demonstrate technician competency in carpet cleaning, water damage
          restoration, fire & smoke restoration, and other specialist areas. Renew every 3 years via{' '}
          <span className="font-medium">iicrc.org</span>. CCW can help coordinate renewal training.
        </p>
      </div>
    </div>
  );
}
