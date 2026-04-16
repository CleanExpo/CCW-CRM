import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/search/semantic
 *
 * Semantic product search using pgvector cosine similarity.
 * Generates an embedding for the query via OpenAI, then searches
 * the product_embeddings table for nearest neighbours.
 */
export async function GET(request: NextRequest) {
  const start = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const languageCode = searchParams.get('language_code') || 'en';

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ detail: 'query parameter is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ detail: 'OPENAI_API_KEY not configured' }, { status: 503 });
    }

    // Generate embedding via OpenAI
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query.trim(),
        encoding_format: 'float',
      }),
    });

    if (!embeddingResponse.ok) {
      const err = await embeddingResponse.text();
      return NextResponse.json({ detail: `OpenAI API error: ${err}` }, { status: 502 });
    }

    const embeddingData = await embeddingResponse.json();
    const embedding: number[] = embeddingData.data[0].embedding;

    // Search via pgvector RPC function
    const supabase = createServerClient();
    const { data, error } = await supabase.rpc('search_products_by_vector', {
      query_embedding: JSON.stringify(embedding),
      match_language: languageCode,
      match_limit: limit,
    });

    if (error) throw error;

    const queryTimeMs = Date.now() - start;

    // Track search analytics (fire-and-forget)
    supabase
      .from('search_analytics')
      .insert({
        query: query.trim(),
        language_code: languageCode,
        search_type: 'semantic',
        result_count: data?.length ?? 0,
        execution_time_ms: queryTimeMs,
      })
      .then(() => {});

    return NextResponse.json({
      query: query.trim(),
      language: languageCode,
      type: 'semantic',
      results: data ?? [],
      total: data?.length ?? 0,
      query_time_ms: queryTimeMs,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
