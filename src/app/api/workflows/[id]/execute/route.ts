import { NextRequest, NextResponse } from 'next/server';
import { getUpstreamApiBase } from '@/lib/api/backend-url';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { dispatchWorkflowTemplate } from '@/lib/workflows/workflow-engine';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const base = getUpstreamApiBase();
  const { id } = await params;

  if (base) {
    try {
      const body = await request.json();
      const response = await fetch(`${base}/api/workflows/${id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    } catch (error) {
      console.error('Error executing workflow:', error);
      return NextResponse.json({ error: 'Failed to execute workflow' }, { status: 500 });
    }
  }

  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = (await request.json()) as {
      trigger_entity_type?: string;
      trigger_entity_id?: string;
      customer_id?: string;
      customer_email?: string;
      payload?: Record<string, unknown>;
    };

    const result = await dispatchWorkflowTemplate(id, {
      ownerUserId: scope.userId,
      triggerEntityType: body.trigger_entity_type ?? 'manual',
      triggerEntityId: body.trigger_entity_id,
      customerId: body.customer_id,
      customerEmail: body.customer_email,
      payload: body.payload,
    });

    if (!result.instance_id) {
      return NextResponse.json({ error: 'Template not found or inactive' }, { status: 404 });
    }

    return NextResponse.json({ success: true, instance_id: result.instance_id });
  } catch (error) {
    console.error('Error executing workflow:', error);
    return NextResponse.json({ error: 'Failed to execute workflow' }, { status: 500 });
  }
}
