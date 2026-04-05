/**
 * Guest Order Approval Portal
 *
 * Public — secured by unique token only, no authentication required.
 * Customer reviews their order and approves or declines.
 */
import { notFound } from 'next/navigation';
import { GuestOrderClient } from './GuestOrderClient';
import { getGuestOrder } from '@/lib/api/mobile';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function GuestOrderPage({ params }: PageProps) {
  const { token } = await params;

  let order;
  try {
    order = await getGuestOrder(token);
  } catch {
    notFound();
  }

  return <GuestOrderClient initialOrder={order} token={token} />;
}
