import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/recommendations/similar/[productId]
 *
 * Returns similar products. Tries pre-computed recommendations first,
 * falls back to vector similarity via pgvector if none exist.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;

    if (!UUID_RE.test(productId)) {
      return NextResponse.json({ detail: 'productId must be a valid UUID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);
    const languageCode = searchParams.get('language_code') || 'en';

    const supabase = createServerClient();

    // Try pre-computed recommendations first
    const { data: precomputed, error: precomputedError } = await supabase
      .from('product_recommendations')
      .select('recommended_product_id, recommendation_type, similarity_score')
      .eq('source_product_id', productId)
      .eq('recommendation_type', 'similar')
      .order('similarity_score', { ascending: false })
      .limit(limit);

    if (precomputedError) throw precomputedError;

    if (precomputed && precomputed.length > 0) {
      // Fetch full product details for recommended IDs
      const recIds = precomputed.map((r) => r.recommended_product_id);
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, sku, name, description, category, price, stock')
        .in('id', recIds);

      if (productsError) throw productsError;

      // Merge scores with product data
      const recommendations = precomputed.map((rec) => {
        const product = products?.find((p) => p.id === rec.recommended_product_id);
        return {
          ...product,
          similarity_score: rec.similarity_score,
        };
      });

      return NextResponse.json({
        product_id: productId,
        recommendations,
        total: recommendations.length,
        source: 'precomputed',
      });
    }

    // Fall back to vector similarity
    const { data: vectorResults, error: vectorError } = await supabase.rpc(
      'get_similar_products_by_embedding',
      {
        source_product_id: productId,
        match_language: languageCode,
        match_limit: limit,
      }
    );

    if (vectorError) throw vectorError;

    return NextResponse.json({
      product_id: productId,
      recommendations: vectorResults ?? [],
      total: vectorResults?.length ?? 0,
      source: 'vector_similarity',
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
