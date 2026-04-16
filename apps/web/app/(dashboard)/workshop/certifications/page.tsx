'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Award } from 'lucide-react';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { apiClient } from '@/lib/api/client';

interface Certification {
  id: string;
  technician_name: string;
  certification: string;
  issuing_body: string;
  issue_date: string;
  expiry_date: string | null;
}

function getCertStatus(expiryDate: string | null): {
  label: string;
  rowClass: string;
  badge: string;
} {
  if (!expiryDate) return { label: 'Active', rowClass: '', badge: 'bg-green-100 text-green-700' };
  const now = new Date();
  const expiry = new Date(expiryDate);
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0)
    return { label: 'Expired', rowClass: 'bg-red-50', badge: 'bg-red-100 text-red-700' };
  if (daysLeft <= 90)
    return {
      label: 'Expiring Soon',
      rowClass: 'bg-yellow-50',
      badge: 'bg-yellow-100 text-yellow-700',
    };
  return { label: 'Active', rowClass: '', badge: 'bg-green-100 text-green-700' };
}

export default function CertificationsPage() {
  const { toast } = useToast();
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    apiClient
      .get<Certification[]>('/api/workshop/certifications', { signal: controller.signal })
      .then(setCerts)
      .catch((e) => {
        if (e.name === 'AbortError') return;
        if (e.status === 404) {
          setCerts([]);
          return;
        }
        toast({
          title: 'Error',
          description: e.message ?? 'Failed to load certifications',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [toast]);

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Technician Certifications</h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Track and manage technician compliance certifications
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Certification
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-muted h-12 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : certs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Award className="text-muted-foreground h-10 w-10" />
              <p className="text-muted-foreground">
                No certifications recorded. Add your first certification to track compliance.
              </p>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" /> Add Certification
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {certs.length} certification{certs.length !== 1 ? 's' : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-hidden rounded-b-lg border-t">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {[
                        'Technician Name',
                        'Certification',
                        'Issuing Body',
                        'Issue Date',
                        'Expiry Date',
                        'Status',
                      ].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {certs.map((cert) => {
                      const { label, rowClass, badge } = getCertStatus(cert.expiry_date);
                      return (
                        <tr key={cert.id} className={`hover:bg-muted/30 ${rowClass}`}>
                          <td className="px-4 py-3 font-medium">{cert.technician_name}</td>
                          <td className="px-4 py-3">{cert.certification}</td>
                          <td className="px-4 py-3">{cert.issuing_body}</td>
                          <td className="px-4 py-3">
                            {new Date(cert.issue_date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            {cert.expiry_date
                              ? new Date(cert.expiry_date).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={badge}>{label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ErrorBoundary>
  );
}
