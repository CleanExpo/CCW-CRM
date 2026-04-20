-- AI Search & Recommendations Schema
-- Phase 4: pgvector semantic search + collaborative filtering
-- Requires: 00000000000002_enable_pgvector.sql
-- DO NOT apply to production until UNI-1772 activation checklist is complete.

-- 1. Product Embeddings (semantic search)
CREATE TABLE IF NOT EXISTS product_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL,
    embedding vector(1536) NOT NULL,
    model_version VARCHAR(50) NOT NULL DEFAULT 'text-embedding-3-small',
    model_provider VARCHAR(50) NOT NULL DEFAULT 'openai',
    generated_from TEXT,
    generation_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_stale BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(product_id, language_code)
);

-- HNSW index for fast cosine-distance nearest-neighbour search
CREATE INDEX IF NOT EXISTS idx_product_embeddings_vector
    ON product_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_product_embeddings_product_id
    ON product_embeddings(product_id);

CREATE INDEX IF NOT EXISTS idx_product_embeddings_language
    ON product_embeddings(language_code);

-- 2. Product Recommendations (pre-computed similarity)
CREATE TABLE IF NOT EXISTS product_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    recommended_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(50) NOT NULL,
    similarity_score FLOAT NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    algorithm_version VARCHAR(50),
    UNIQUE(source_product_id, recommended_product_id, recommendation_type)
);

CREATE INDEX IF NOT EXISTS idx_product_recommendations_source
    ON product_recommendations(source_product_id, recommendation_type, similarity_score DESC);

-- 3. Customer-Product Interactions (collaborative filtering signal)
CREATE TABLE IF NOT EXISTS customer_product_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL,
    interaction_count INT NOT NULL DEFAULT 1,
    last_interaction TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_id VARCHAR(100),
    source VARCHAR(50) DEFAULT 'web',
    UNIQUE(customer_id, product_id, interaction_type)
);

CREATE INDEX IF NOT EXISTS idx_customer_interactions_customer
    ON customer_product_interactions(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_interactions_product
    ON customer_product_interactions(product_id);

-- 4. Product Co-occurrences (frequently bought together)
CREATE TABLE IF NOT EXISTS product_co_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_a_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_b_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    co_occurrence_count INT NOT NULL DEFAULT 1,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_a_id, product_b_id),
    CHECK (product_a_id < product_b_id)
);

CREATE INDEX IF NOT EXISTS idx_co_occurrences_product_a
    ON product_co_occurrences(product_a_id, co_occurrence_count DESC);

-- 5. Search Analytics
CREATE TABLE IF NOT EXISTS search_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    language_code VARCHAR(10) NOT NULL DEFAULT 'en',
    search_type VARCHAR(50) NOT NULL DEFAULT 'hybrid',
    result_count INT NOT NULL DEFAULT 0,
    execution_time_ms FLOAT,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at
    ON search_analytics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_analytics_query
    ON search_analytics(query);
