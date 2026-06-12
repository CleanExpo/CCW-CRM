import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { syncBankAccountFeeds } from '@/lib/bank-reconciliation/sync-feeds';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const userId = process.env.CRON_INTEGRATION_USER_ID?.trim();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'CRON_INTEGRATION_USER_ID not set' },
        { status: 503 }
      );
    }

    const accounts = await prisma.bankAccount.findMany({
      where: { ownerUserId: userId, isActive: true },
      select: { id: true, feedProvider: true },
    });

    let transactions_synced = 0;
    const account_results: Array<{ account_id: string; synced: number; message?: string }> = [];

    for (const account of accounts) {
      const result = await syncBankAccountFeeds({ userId, accountId: account.id });
      if (result.ok) {
        transactions_synced += result.body.transactions_synced;
        account_results.push({
          account_id: account.id,
          synced: result.body.transactions_synced,
          message: result.body.message,
        });
      }
    }

    logger.info('Sync bank feeds cron', {
      accounts: accounts.length,
      transactions_synced,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      accounts_processed: accounts.length,
      transactions_synced,
      account_results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Sync bank feeds cron error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
