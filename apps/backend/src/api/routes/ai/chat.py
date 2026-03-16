"""Chat assistant API endpoints."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID, uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.agents.chat_assistant import ChatAssistant
from src.config.database import get_db
from src.db.demo_models import ConversationHistory

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/ai/chat", tags=["AI Chat"])


# Request/Response Models
class ChatMessageRequest(BaseModel):
    """Request to send a chat message."""

    conversation_id: str = Field(description="Conversation ID")
    message: str = Field(description="User message", min_length=1, max_length=2000)
    user_id: str | None = Field(default=None, description="Optional user ID")


class ChatMessageResponse(BaseModel):
    """Response from chat message."""

    conversation_id: str
    message: str
    tools_used: list[str] = Field(default_factory=list)
    error: str | None = None


class NewConversationResponse(BaseModel):
    """Response when creating a new conversation."""

    conversation_id: str
    created_at: str


class ConversationHistoryResponse(BaseModel):
    """Response with conversation history."""

    conversation_id: str
    messages: list[dict[str, str]]
    total: int


# Initialize chat assistant (singleton)
_chat_assistant: ChatAssistant | None = None


def get_chat_assistant() -> ChatAssistant:
    """
    Get or create the chat assistant singleton.

    Returns:
        ChatAssistant instance
    """
    global _chat_assistant
    if _chat_assistant is None:
        _chat_assistant = ChatAssistant()
        logger.info("Chat assistant initialized")
    return _chat_assistant


@router.post("/new")
async def create_new_conversation() -> NewConversationResponse:
    """
    Create a new conversation.

    Returns:
        NewConversationResponse with new conversation ID
    """
    from datetime import UTC, datetime

    conversation_id = str(uuid4())

    logger.info("New conversation created", conversation_id=conversation_id)

    return NewConversationResponse(
        conversation_id=conversation_id,
        created_at=datetime.now(UTC).isoformat(),
    )


@router.post("/message")
async def send_message(
    request: ChatMessageRequest,
    assistant: Annotated[ChatAssistant, Depends(get_chat_assistant)],
) -> ChatMessageResponse:
    """
    Send a message and get a response.

    Args:
        request: Chat message request
        assistant: Chat assistant dependency

    Returns:
        ChatMessageResponse with AI response

    Raises:
        HTTPException: If message processing fails
    """
    logger.info(
        "Processing chat message",
        conversation_id=request.conversation_id,
        message_length=len(request.message),
    )

    try:
        # Execute chat agent
        result = await assistant.execute(
            task=request.message,
            context={
                "conversation_id": request.conversation_id,
                "user_id": request.user_id,
            },
        )

        if result.get("error"):
            logger.error(
                "Chat execution error",
                conversation_id=request.conversation_id,
                error=result["error"],
            )
            raise HTTPException(status_code=500, detail=result["error"])

        return ChatMessageResponse(
            conversation_id=result["conversation_id"],
            message=result["response"],
            tools_used=result.get("tools_used", []),
            error=None,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Unexpected error in chat",
            conversation_id=request.conversation_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process message: {str(e)}",
        ) from e


@router.post("/stream")
async def stream_message(
    request: ChatMessageRequest,
    assistant: Annotated[ChatAssistant, Depends(get_chat_assistant)],
) -> StreamingResponse:
    """
    Stream a chat response.

    Args:
        request: Chat message request
        assistant: Chat assistant dependency

    Returns:
        StreamingResponse with chunked AI response
    """
    logger.info(
        "Streaming chat message",
        conversation_id=request.conversation_id,
        message_length=len(request.message),
    )

    async def generate():
        """Generate response chunks."""
        try:
            async for chunk in assistant.stream(
                task=request.message,
                context={
                    "conversation_id": request.conversation_id,
                    "user_id": request.user_id,
                },
            ):
                yield f"data: {chunk}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            logger.error(
                "Streaming error",
                conversation_id=request.conversation_id,
                error=str(e),
            )
            yield f"data: [ERROR] {str(e)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
    )


@router.get("/history/{conversation_id}")
async def get_conversation_history(
    conversation_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
) -> ConversationHistoryResponse:
    """
    Get conversation history.

    Args:
        conversation_id: Conversation ID
        db: Database session
        limit: Maximum number of messages to return

    Returns:
        ConversationHistoryResponse with message history

    Raises:
        HTTPException: If conversation not found or fetch fails
    """
    logger.info("Fetching conversation history", conversation_id=conversation_id)

    try:
        # Validate UUID format
        try:
            conv_uuid = UUID(conversation_id)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid conversation_id format: {conversation_id}",
            ) from e

        # Query conversation history
        stmt = (
            select(ConversationHistory)
            .where(ConversationHistory.conversation_id == conv_uuid)
            .order_by(ConversationHistory.created_at)
            .limit(limit)
        )

        result = await db.execute(stmt)
        history = result.scalars().all()

        # Format messages
        messages = [
            {
                "role": h.role,
                "content": h.content,
                "created_at": h.created_at.isoformat(),
            }
            for h in history
        ]

        logger.info(
            "History retrieved",
            conversation_id=conversation_id,
            message_count=len(messages),
        )

        return ConversationHistoryResponse(
            conversation_id=conversation_id,
            messages=messages,
            total=len(messages),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to fetch history",
            conversation_id=conversation_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch conversation history: {str(e)}",
        ) from e


@router.delete("/history/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """
    Delete a conversation and its history.

    Args:
        conversation_id: Conversation ID
        db: Database session

    Returns:
        Success message

    Raises:
        HTTPException: If deletion fails
    """
    logger.info("Deleting conversation", conversation_id=conversation_id)

    try:
        # Validate UUID format
        try:
            conv_uuid = UUID(conversation_id)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid conversation_id format: {conversation_id}",
            ) from e

        # Delete all messages in conversation
        stmt = select(ConversationHistory).where(
            ConversationHistory.conversation_id == conv_uuid
        )
        result = await db.execute(stmt)
        messages = result.scalars().all()

        for message in messages:
            await db.delete(message)

        await db.commit()

        logger.info(
            "Conversation deleted",
            conversation_id=conversation_id,
            messages_deleted=len(messages),
        )

        return {
            "message": f"Conversation {conversation_id} deleted successfully",
            "messages_deleted": str(len(messages)),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to delete conversation",
            conversation_id=conversation_id,
            error=str(e),
        )
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete conversation: {str(e)}",
        ) from e
