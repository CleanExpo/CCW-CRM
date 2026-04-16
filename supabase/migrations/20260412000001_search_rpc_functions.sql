-- RPC functions for pgvector semantic search
-- Called from Next.js API routes via supabase.rpc()

-- 1. Search products by embedding vector (cosine similarity)
CREATE OR REPLACE FUNCTION search_products_by_vector(
  query_embedding text,
  match_language text DEFAULT 'en',
  match_limit int DEFAULT 20
)
RETURNS TABLE(
  product_id uuid,
  sku text,
  name text,
  description text,
  category text,
  price numeric,
  stock bigint,
  similarity_score float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS product_id,
    p.sku::text,
    p.name::text,
    p.description::text,
    p.category::text,
    p.price,
    p.stock,
    (1 - (pe.embedding <=> query_embedding::vector(1536)))::float AS similarity_score
  FROM product_embeddings pe
  JOIN products p ON p.id = pe.product_id
  WHERE pe.language_code = match_language
    AND pe.is_stale = FALSE
  ORDER BY pe.embedding <=> query_embedding::vector(1536)
  LIMIT match_limit;
END;
$$;

-- 2. Find similar products by source product embedding (recommendation fallback)
CREATE OR REPLACE FUNCTION get_similar_products_by_embedding(
  source_product_id uuid,
  match_language text DEFAULT 'en',
  match_limit int DEFAULT 10
)
RETURNS TABLE(
  product_id uuid,
  sku text,
  name text,
  description text,
  category text,
  price numeric,
  stock bigint,
  similarity_score float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  source_embedding vector(1536);
BEGIN
  -- Get the source product's embedding
  SELECT pe.embedding INTO source_embedding
  FROM product_embeddings pe
  WHERE pe.product_id = source_product_id
    AND pe.language_code = match_language
    AND pe.is_stale = FALSE
  LIMIT 1;

  IF source_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id AS product_id,
    p.sku::text,
    p.name::text,
    p.description::text,
    p.category::text,
    p.price,
    p.stock,
    (1 - (pe.embedding <=> source_embedding))::float AS similarity_score
  FROM product_embeddings pe
  JOIN products p ON p.id = pe.product_id
  WHERE pe.language_code = match_language
    AND pe.is_stale = FALSE
    AND pe.product_id != source_product_id
  ORDER BY pe.embedding <=> source_embedding
  LIMIT match_limit;
END;
$$;
