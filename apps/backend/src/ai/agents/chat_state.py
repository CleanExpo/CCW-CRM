"""Chat agent state management for LangGraph."""

from collections.abc import Sequence
from typing import Annotated, Any, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class ChatState(TypedDict):
    """
    State for the chat assistant agent.

    This state flows through the LangGraph nodes as the conversation progresses.
    """

    # Messages in the conversation (LangGraph manages this with add_messages reducer)
    messages: Annotated[Sequence[BaseMessage], add_messages]

    # Current user message being processed
    user_message: str

    # Conversation ID for tracking history
    conversation_id: str

    # User ID for permissions and history
    user_id: str | None

    # Context retrieved from tools (ERP data, RAG results)
    context: dict[str, Any]

    # Tools available to the agent
    tools: list[str]

    # Generated response
    response: str | None

    # Whether tools were used in this turn
    tools_used: list[str]

    # Error message if something went wrong
    error: str | None

    # Metadata for tracking
    metadata: dict[str, Any]
