"""Tests for RAG search functionality."""

import pytest
from unittest.mock import AsyncMock, patch

from src.rag.storage import RAGStore
from src.rag.models import SearchType


@pytest.mark.asyncio
async def test_rag_store_initialization():
    """Test RAG store can be initialized."""
    store = RAGStore()
    await store.initialize()

    assert store.supabase is not None
    assert store.client is not None
    assert store.embedding_provider is not None


@pytest.mark.asyncio
async def test_hybrid_search_call():
    """Test hybrid search function call structure."""
    store = RAGStore()
    await store.initialize()

    # Mock embedding provider
    store.embedding_provider.get_embedding = AsyncMock(return_value=[0.1] * 1536)

    # Mock Supabase client
    store.client.rpc = AsyncMock(return_value=MagicMock(data=[]))

    # Call hybrid search
    results = await store.hybrid_search(
        query="test query",
        project_id="test-project",
        vector_weight=0.6,
        keyword_weight=0.4,
        limit=10,
    )

    # Verify embedding was generated
    assert store.embedding_provider.get_embedding.called

    # Verify RPC was called with correct function
    assert store.client.rpc.called
    call_args = store.client.rpc.call_args
    assert call_args[0][0] == "hybrid_search"


@pytest.mark.asyncio
async def test_vector_search_call():
    """Test vector search function call."""
    store = RAGStore()
    await store.initialize()

    # Mock embedding provider
    store.embedding_provider.get_embedding = AsyncMock(return_value=[0.1] * 1536)

    # Mock Supabase client table query
    mock_execute = MagicMock()
    mock_execute.data = []

    mock_builder = MagicMock()
    mock_builder.execute.return_value = mock_execute
    mock_builder.select.return_value = mock_builder
    mock_builder.match.return_value = mock_builder
    mock_builder.order.return_value = mock_builder
    mock_builder.limit.return_value = mock_builder

    store.client.table = MagicMock(return_value=mock_builder)

    # Call vector search
    results = await store.vector_search(
        query="test query",
        project_id="test-project",
        limit=5,
    )

    # Verify results structure
    assert isinstance(results, list)


# Integration tests (require database)
@pytest.mark.integration
@pytest.mark.asyncio
async def test_search_knowledge_base_tool():
    """Test the search_knowledge_base tool (requires database)."""
    from src.tools.rag_tools import search_knowledge_base

    # This test requires:
    # 1. Supabase running
    # 2. Documents uploaded
    # 3. OpenAI API key for embeddings

    result = await search_knowledge_base(
        query="test",
        project_id="test-project",
        search_type="vector",
        limit=5,
    )

    assert "status" in result
    assert "results" in result
    assert isinstance(result["results"], list)


# Run integration tests with:
# pytest tests/rag/test_search.py -m integration -v
