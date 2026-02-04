-- AI-Powered Search & Recommendations Database Schema
-- Created: 2026-01-22
-- Purpose: Support for semantic search, product recommendations, and AI-powered features using pgvector

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Product Embeddings Table
-- Vector embeddings for semantic search (1536 dimensions for OpenAI text-embedding-3-small)

CREATE TABLE product_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Product reference
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Language reference (multi-language embeddings)
    language_code VARCHAR(10) NOT NULL,

    -- Vector embedding (1536 dimensions for OpenAI text-embedding-3-small)
    embedding vector(1536) NOT NULL,

    -- Model metadata
    model_version VARCHAR(50) NOT NULL DEFAULT 'text-embedding-3-small',
    model_provider VARCHAR(50) NOT NULL DEFAULT 'openai',

    -- Generation metadata
    generated_from TEXT, -- What text was used to generate this embedding
    generation_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint: one embedding per product per language
    UNIQUE(product_id, language_code)
);

-- Indexes for product embeddings
CREATE INDEX idx_product_embeddings_product ON product_embeddings(product_id);
CREATE INDEX idx_product_embeddings_language ON product_embeddings(language_code);
CREATE INDEX idx_product_embeddings_timestamp ON product_embeddings(generation_timestamp DESC);

-- Vector similarity index (IVFFlat for fast approximate nearest neighbor search)
-- Lists = sqrt(rows) is a good starting point, we'll use 100 for ~10,000 products
CREATE INDEX idx_product_embeddings_vector_cosine
ON product_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Alternative: HNSW index (more accurate but slower to build)
-- Uncomment below and comment out IVFFlat if you prefer HNSW
-- CREATE INDEX idx_product_embeddings_vector_hnsw
-- ON product_embeddings
-- USING hnsw (embedding vector_cosine_ops);

-- 2. Product Recommendations Table
-- Precomputed product recommendations

CREATE TABLE product_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source product
    source_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Recommended product
    recommended_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Recommendation details
    recommendation_type VARCHAR(50) NOT NULL, -- 'similar', 'complementary', 'frequently_bought_together', 'personalized'
    score NUMERIC(5, 4) NOT NULL CHECK (score >= 0 AND score <= 1), -- 0.0 to 1.0
    rank INTEGER NOT NULL, -- Ranking position (1 = top recommendation)

    -- Reasoning
    reason TEXT, -- Human-readable explanation

    -- Metadata
    algorithm_version VARCHAR(50), -- Which algorithm generated this
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent recommending same product
    CHECK (source_product_id != recommended_product_id)
);

-- Indexes for product recommendations
CREATE INDEX idx_product_recommendations_source ON product_recommendations(source_product_id, recommendation_type, rank);
CREATE INDEX idx_product_recommendations_recommended ON product_recommendations(recommended_product_id);
CREATE INDEX idx_product_recommendations_score ON product_recommendations(score DESC);
CREATE INDEX idx_product_recommendations_generated ON product_recommendations(generated_at DESC);

-- 3. Customer Product Interactions Table
-- Track customer interactions for personalized recommendations

CREATE TABLE customer_product_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Customer reference
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

    -- Product reference
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Interaction details
    interaction_type VARCHAR(50) NOT NULL, -- 'view', 'add_to_cart', 'purchase', 'search', 'wishlist'
    interaction_count INTEGER NOT NULL DEFAULT 1, -- Number of times this interaction occurred

    -- Context
    session_id VARCHAR(255), -- Session identifier
    source VARCHAR(100), -- 'web', 'mobile', 'voice', 'api'

    -- Timestamps
    first_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for customer interactions
CREATE INDEX idx_customer_interactions_customer ON customer_product_interactions(customer_id);
CREATE INDEX idx_customer_interactions_product ON customer_product_interactions(product_id);
CREATE INDEX idx_customer_interactions_type ON customer_product_interactions(interaction_type);
CREATE INDEX idx_customer_interactions_last ON customer_product_interactions(last_interaction_at DESC);
CREATE UNIQUE INDEX idx_customer_interactions_unique ON customer_product_interactions(customer_id, product_id, interaction_type);

-- 4. Product Co-occurrences Table
-- Track products frequently bought together (market basket analysis)

CREATE TABLE product_co_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Product pair
    product_a_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_b_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Co-occurrence metrics
    co_occurrence_count INTEGER NOT NULL DEFAULT 1, -- How many times bought together
    confidence NUMERIC(5, 4), -- Confidence score (0.0 to 1.0)
    lift NUMERIC(8, 4), -- Lift score (>1.0 = positive correlation)

    -- Time windows
    last_co_occurrence_at TIMESTAMPTZ,
    first_co_occurrence_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent self-pairing
    CHECK (product_a_id != product_b_id)
);

-- Indexes for product co-occurrences
CREATE INDEX idx_product_co_occurrences_a ON product_co_occurrences(product_a_id, confidence DESC);
CREATE INDEX idx_product_co_occurrences_b ON product_co_occurrences(product_b_id, confidence DESC);
CREATE INDEX idx_product_co_occurrences_count ON product_co_occurrences(co_occurrence_count DESC);
CREATE INDEX idx_product_co_occurrences_lift ON product_co_occurrences(lift DESC);
CREATE UNIQUE INDEX idx_product_co_occurrences_unique ON product_co_occurrences(
    LEAST(product_a_id, product_b_id),
    GREATEST(product_a_id, product_b_id)
);

-- 5. Search Queries Table
-- Track search queries for analytics and improvement

CREATE TABLE search_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Query details
    query_text TEXT NOT NULL,
    query_language VARCHAR(10) NOT NULL DEFAULT 'en',
    query_type VARCHAR(50) NOT NULL DEFAULT 'semantic', -- 'semantic', 'keyword', 'hybrid'

    -- Customer reference
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    session_id VARCHAR(255),

    -- Results
    results_count INTEGER NOT NULL DEFAULT 0,
    results_product_ids UUID[], -- Array of product IDs returned

    -- Performance
    query_time_ms INTEGER, -- Query execution time in milliseconds

    -- User actions
    clicked_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    clicked_rank INTEGER, -- Which result was clicked (1 = first result)
    converted BOOLEAN DEFAULT FALSE, -- Did the search lead to a purchase?

    -- Timestamps
    searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for search queries
CREATE INDEX idx_search_queries_text ON search_queries(query_text);
CREATE INDEX idx_search_queries_language ON search_queries(query_language);
CREATE INDEX idx_search_queries_customer ON search_queries(customer_id);
CREATE INDEX idx_search_queries_searched_at ON search_queries(searched_at DESC);
CREATE INDEX idx_search_queries_converted ON search_queries(converted);

-- 6. Voice Search Sessions Table
-- Track voice search sessions (extends AP2 voice sessions)

CREATE TABLE voice_search_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Session details
    session_id VARCHAR(255) NOT NULL UNIQUE,
    language VARCHAR(10) NOT NULL DEFAULT 'en',

    -- Voice assistant
    assistant_type VARCHAR(50), -- 'siri', 'google_assistant', 'alexa'

    -- Search queries in this session
    query_count INTEGER NOT NULL DEFAULT 0,
    queries JSONB, -- Array of query objects

    -- Results
    total_results_shown INTEGER NOT NULL DEFAULT 0,
    conversion_count INTEGER NOT NULL DEFAULT 0,

    -- Session lifecycle
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_voice_search_sessions_session ON voice_search_sessions(session_id);
CREATE INDEX idx_voice_search_sessions_assistant ON voice_search_sessions(assistant_type);
CREATE INDEX idx_voice_search_sessions_started ON voice_search_sessions(started_at DESC);

-- Add triggers for updated_at timestamps

CREATE TRIGGER update_product_embeddings_updated_at
    BEFORE UPDATE ON product_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_recommendations_updated_at
    BEFORE UPDATE ON product_recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_interactions_updated_at
    BEFORE UPDATE ON customer_product_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_co_occurrences_updated_at
    BEFORE UPDATE ON product_co_occurrences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Helper Functions for Vector Search

-- Function to search products by embedding similarity
CREATE OR REPLACE FUNCTION search_products_by_embedding(
    query_embedding vector(1536),
    query_language VARCHAR(10),
    result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    product_id UUID,
    similarity_score REAL,
    product_sku VARCHAR,
    product_name VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        1 - (pe.embedding <=> query_embedding) AS similarity_score,
        p.sku,
        p.name
    FROM product_embeddings pe
    JOIN products p ON p.id = pe.product_id
    WHERE pe.language_code = query_language
        AND p.is_active = TRUE
    ORDER BY pe.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get product recommendations
CREATE OR REPLACE FUNCTION get_product_recommendations_func(
    source_product_uuid UUID,
    rec_type VARCHAR(50),
    result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    recommended_product_id UUID,
    score NUMERIC,
    reason TEXT,
    product_sku VARCHAR,
    product_name VARCHAR,
    product_price NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pr.recommended_product_id,
        pr.score,
        pr.reason,
        p.sku,
        p.name,
        p.price
    FROM product_recommendations pr
    JOIN products p ON p.id = pr.recommended_product_id
    WHERE pr.source_product_id = source_product_uuid
        AND pr.recommendation_type = rec_type
        AND p.is_active = TRUE
    ORDER BY pr.rank
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation

COMMENT ON TABLE product_embeddings IS 'Vector embeddings for products (1536 dims) supporting semantic search in multiple languages';
COMMENT ON TABLE product_recommendations IS 'Precomputed product recommendations (similar, complementary, frequently bought together)';
COMMENT ON TABLE customer_product_interactions IS 'Customer interaction tracking for personalized recommendations';
COMMENT ON TABLE product_co_occurrences IS 'Products frequently bought together (market basket analysis)';
COMMENT ON TABLE search_queries IS 'Search query tracking for analytics and relevance improvements';
COMMENT ON TABLE voice_search_sessions IS 'Voice search session tracking (Siri, Google Assistant, Alexa)';

COMMENT ON INDEX idx_product_embeddings_vector_cosine IS 'IVFFlat index for fast approximate nearest neighbor search using cosine similarity';

-- Migration complete
-- Version: 1.0
-- Author: CCW Team + Claude Code
-- Date: 2026-01-22

-- Performance notes:
-- - IVFFlat index provides good balance of speed and accuracy for ~10K-100K products
-- - For >100K products, consider HNSW index (more accurate, slower to build)
-- - Regularly VACUUM ANALYZE product_embeddings for optimal index performance
-- - Monitor query performance and adjust 'lists' parameter in IVFFlat index if needed
