import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/search/embed
 *
 * Generates OpenAI embeddings for products that don't have them yet.
 * Secured with CRON_SECRET bearer token. Processes in batches to
 * stay within Vercel's serverless timeout.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ detail: 'OPENAI_API_KEY not configured' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const batchSize = Math.min(parseInt(String(body.batch_size || '10')), 20);
    const languageCode = String(body.language_code || 'en');

    const supabase = createServerClient();

    // Find product IDs that already have embeddings
    const { data: existingEmbeddings } = await supabase
      .from('product_embeddings')
      .select('product_id')
      .eq('language_code', languageCode);

    const existingIds = (existingEmbeddings ?? []).map((e) => e.product_id);

    // Find products that need embeddings
    let productsQuery = supabase
      .from('products')
      .select('id, sku, name, description, category, price, stock')
      .limit(batchSize);

    if (existingIds.length > 0) {
      productsQuery = productsQuery.not('id', 'in', `(${existingIds.join(',')})`);
    }

    const { data: products, error: productsError } = await productsQuery;
    if (productsError) throw productsError;

    if (!products || products.length === 0) {
      // Count total for remaining stat
      const { count } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true });

      return NextResponse.json({
        success: true,
        processed: 0,
        skipped: 0,
        failed: 0,
        remaining: 0,
        total_products: count ?? 0,
        total_embedded: existingIds.length,
        message: 'All products already have embeddings',
      });
    }

    // Build embedding texts
    const texts = products.map((p) => {
      const stockStatus = (p.stock ?? 0) > 0 ? 'In stock' : 'Out of stock';
      return `Product: ${p.name} | SKU: ${p.sku} | Category: ${p.category || 'Uncategorised'} | Description: ${p.description || ''} | Price: $${p.price || 0} | ${stockStatus}`;
    });

    // Batch call OpenAI Embeddings API
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts,
        encoding_format: 'float',
      }),
    });

    if (!embeddingResponse.ok) {
      const err = await embeddingResponse.text();
      return NextResponse.json({ detail: `OpenAI API error: ${err}` }, { status: 502 });
    }

    const embeddingData = await embeddingResponse.json();
    const embeddings: { embedding: number[]; index: number }[] = embeddingData.data;

    // Insert embeddings into Supabase
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of embeddings) {
      const product = products[item.index];
      const text = texts[item.index];

      const { error: insertError } = await supabase.from('product_embeddings').upsert(
        {
          product_id: product.id,
          language_code: languageCode,
          embedding: JSON.stringify(item.embedding),
          model_version: 'text-embedding-3-small',
          model_provider: 'openai',
          generated_from: text.substring(0, 500),
        },
        { onConflict: 'product_id,language_code' }
      );

      if (insertError) {
        failed++;
        errors.push(`${product.sku}: ${insertError.message}`);
      } else {
        processed++;
      }
    }

    // Count remaining
    const { count: totalProducts } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true });

    const totalEmbedded = existingIds.length + processed;
    const remaining = (totalProducts ?? 0) - totalEmbedded;

    return NextResponse.json({
      success: failed === 0,
      processed,
      skipped: 0,
      failed,
      remaining,
      total_products: totalProducts ?? 0,
      total_embedded: totalEmbedded,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
