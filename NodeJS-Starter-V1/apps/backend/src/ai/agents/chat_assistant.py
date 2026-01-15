"""Chat assistant agent for natural language ERP queries."""

import json
from typing import Any, AsyncGenerator
from uuid import UUID, uuid4

import structlog
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph

from src.ai.base_agent import BaseAgent
from src.ai.ollama_client import get_ollama_client
from src.ai.prompts import CHAT_ASSISTANT_SYSTEM_PROMPT
from src.ai.tools.erp_tools import (
    GetQuoteDetailsTool,
    SearchCustomersTool,
    SearchOrdersTool,
    SearchProductsTool,
)
from src.db.demo_models import ConversationHistory

from .chat_state import ChatState

logger = structlog.get_logger(__name__)


class ChatAssistant(BaseAgent):
    """
    Chat assistant agent for natural language ERP queries.

    Uses LangGraph to orchestrate:
    1. Receive user message
    2. Determine if tools are needed
    3. Execute tools to fetch ERP data
    4. Generate response with context
    5. Save conversation history
    """

    def __init__(self):
        super().__init__(
            agent_id="chat_assistant",
            name="Chat Assistant",
            auto_register=False  # Register manually after setting capabilities
        )

        # Set capabilities for agent registry
        self.capabilities = ["chat", "customer_support", "data_query", "conversation"]
        self.description = "Natural language chat assistant for ERP data queries"
        self.estimated_execution_time = 5  # seconds
        self.requires_verification = False

        # Initialize Ollama client
        self.ollama = get_ollama_client()

        # Register ERP tools
        self.register_tool(SearchProductsTool())
        self.register_tool(SearchCustomersTool())
        self.register_tool(SearchOrdersTool())
        self.register_tool(GetQuoteDetailsTool())

        # Build LangGraph state graph
        self.graph = self._build_graph()

        # Now register with agent registry after full initialization
        self._schedule_registration()

    def _build_graph(self) -> StateGraph:
        """
        Build the LangGraph state graph for chat flow.

        Flow:
        START → receive_message → check_need_tools → [execute_tools] → generate_response → save_history → END
        """
        workflow = StateGraph(ChatState)

        # Add nodes
        workflow.add_node("receive_message", self._receive_message)
        workflow.add_node("check_need_tools", self._check_need_tools)
        workflow.add_node("execute_tools", self._execute_tools)
        workflow.add_node("generate_response", self._generate_response)
        workflow.add_node("save_history", self._save_history)

        # Define edges
        workflow.set_entry_point("receive_message")
        workflow.add_edge("receive_message", "check_need_tools")

        # Conditional edge: use tools or skip to response
        workflow.add_conditional_edges(
            "check_need_tools",
            self._should_use_tools,
            {
                "use_tools": "execute_tools",
                "skip_tools": "generate_response",
            },
        )

        workflow.add_edge("execute_tools", "generate_response")
        workflow.add_edge("generate_response", "save_history")
        workflow.add_edge("save_history", END)

        return workflow.compile()

    async def _receive_message(self, state: ChatState) -> ChatState:
        """
        Receive and prepare user message.

        Args:
            state: Current chat state

        Returns:
            Updated state with message added
        """
        logger.info(
            "Receiving message",
            conversation_id=state["conversation_id"],
            message_length=len(state["user_message"]),
        )

        # Add user message to messages list
        state["messages"].append(HumanMessage(content=state["user_message"]))

        return state

    async def _check_need_tools(self, state: ChatState) -> ChatState:
        """
        Analyze if tools are needed to answer the query.

        Args:
            state: Current chat state

        Returns:
            Updated state with tools decision
        """
        user_message = state["user_message"].lower()

        # Simple keyword detection (can be enhanced with LLM classification)
        needs_tools = any(
            keyword in user_message
            for keyword in [
                "product",
                "customer",
                "order",
                "quote",
                "inventory",
                "stock",
                "price",
                "search",
                "find",
                "show",
                "list",
            ]
        )

        state["metadata"]["needs_tools"] = needs_tools

        logger.info(
            "Tool check complete",
            conversation_id=state["conversation_id"],
            needs_tools=needs_tools,
        )

        return state

    def _should_use_tools(self, state: ChatState) -> str:
        """
        Decide whether to execute tools or skip to response.

        Args:
            state: Current chat state

        Returns:
            "use_tools" or "skip_tools"
        """
        return "use_tools" if state["metadata"].get("needs_tools") else "skip_tools"

    async def _execute_tools(self, state: ChatState) -> ChatState:
        """
        Execute relevant tools to fetch ERP data.

        Args:
            state: Current chat state

        Returns:
            Updated state with context from tools
        """
        logger.info(
            "Executing tools",
            conversation_id=state["conversation_id"],
            available_tools=len(self.tools),
        )

        context_data = []
        tools_used = []

        # Determine which tools to use based on message content
        user_message = state["user_message"].lower()

        try:
            # Search products
            if any(word in user_message for word in ["product", "inventory", "stock"]):
                product_tool = next(
                    (t for t in self.tools if t.name == "search_products"), None
                )
                if product_tool:
                    # Extract search query (simple approach - can be enhanced)
                    query = user_message.split()[-1] if user_message.split() else ""
                    result = await product_tool.execute(query=query, limit=5)
                    if result.success:
                        context_data.append(
                            {"type": "products", "data": result.data["products"]}
                        )
                        tools_used.append("search_products")

            # Search customers
            if "customer" in user_message:
                customer_tool = next(
                    (t for t in self.tools if t.name == "search_customers"), None
                )
                if customer_tool:
                    query = user_message.split()[-1] if user_message.split() else ""
                    result = await customer_tool.execute(query=query, limit=5)
                    if result.success:
                        context_data.append(
                            {"type": "customers", "data": result.data["customers"]}
                        )
                        tools_used.append("search_customers")

            # Search orders
            if "order" in user_message:
                order_tool = next(
                    (t for t in self.tools if t.name == "search_orders"), None
                )
                if order_tool:
                    result = await order_tool.execute(limit=5)
                    if result.success:
                        context_data.append(
                            {"type": "orders", "data": result.data["orders"]}
                        )
                        tools_used.append("search_orders")

            state["context"]["tool_results"] = context_data
            state["tools_used"] = tools_used

            logger.info(
                "Tools executed",
                conversation_id=state["conversation_id"],
                tools_used=tools_used,
                results_count=len(context_data),
            )

        except Exception as e:
            logger.error(
                "Tool execution failed",
                conversation_id=state["conversation_id"],
                error=str(e),
            )
            state["error"] = f"Failed to fetch data: {str(e)}"

        return state

    async def _generate_response(self, state: ChatState) -> ChatState:
        """
        Generate AI response using Ollama.

        Args:
            state: Current chat state

        Returns:
            Updated state with generated response
        """
        logger.info(
            "Generating response",
            conversation_id=state["conversation_id"],
            has_context=bool(state["context"].get("tool_results")),
        )

        try:
            # Build messages for LLM
            messages = [
                {"role": "system", "content": CHAT_ASSISTANT_SYSTEM_PROMPT},
            ]

            # Add conversation history (last 5 messages for context)
            for msg in state["messages"][-5:]:
                if isinstance(msg, HumanMessage):
                    messages.append({"role": "user", "content": msg.content})
                elif isinstance(msg, AIMessage):
                    messages.append({"role": "assistant", "content": msg.content})

            # Add context from tools if available
            if state["context"].get("tool_results"):
                context_str = self._format_tool_results(
                    state["context"]["tool_results"]
                )
                messages.append(
                    {
                        "role": "system",
                        "content": f"Here is relevant data from the ERP system:\n\n{context_str}",
                    }
                )

            # Generate response
            response = await self.ollama.chat(
                messages=messages,
                temperature=0.7,
                max_tokens=500,
            )

            state["response"] = response
            state["messages"].append(AIMessage(content=response))

            logger.info(
                "Response generated",
                conversation_id=state["conversation_id"],
                response_length=len(response),
            )

        except Exception as e:
            logger.error(
                "Response generation failed",
                conversation_id=state["conversation_id"],
                error=str(e),
            )
            state["error"] = f"Failed to generate response: {str(e)}"
            state["response"] = (
                "I apologize, but I encountered an error processing your request. "
                "Please try again or rephrase your question."
            )

        return state

    async def _save_history(self, state: ChatState) -> ChatState:
        """
        Save conversation to database.

        Args:
            state: Current chat state

        Returns:
            Updated state (unchanged)
        """
        logger.info(
            "Saving conversation history",
            conversation_id=state["conversation_id"],
        )

        try:
            async with self.get_db_session() as db:
                # Save user message
                user_history = ConversationHistory(
                    conversation_id=UUID(state["conversation_id"]),
                    role="user",
                    content=state["user_message"],
                    user_id=UUID(state["user_id"]) if state["user_id"] else None,
                )
                db.add(user_history)

                # Save assistant response
                if state["response"]:
                    assistant_history = ConversationHistory(
                        conversation_id=UUID(state["conversation_id"]),
                        role="assistant",
                        content=state["response"],
                        user_id=UUID(state["user_id"]) if state["user_id"] else None,
                    )
                    db.add(assistant_history)

                await db.commit()

            logger.info(
                "History saved",
                conversation_id=state["conversation_id"],
            )

        except Exception as e:
            logger.error(
                "Failed to save history",
                conversation_id=state["conversation_id"],
                error=str(e),
            )
            # Don't fail the request if history save fails

        return state

    def _format_tool_results(self, tool_results: list[dict[str, Any]]) -> str:
        """
        Format tool results into readable text for LLM context.

        Args:
            tool_results: List of tool execution results

        Returns:
            Formatted string
        """
        formatted = []

        for result in tool_results:
            result_type = result["type"]
            data = result["data"]

            if result_type == "products" and data:
                formatted.append("**Products:**")
                for product in data[:5]:  # Limit to 5 items
                    formatted.append(
                        f"- {product['name']} (SKU: {product['sku']}) - "
                        f"${product['price']} - Stock: {product['stock']} - "
                        f"Category: {product['category']}"
                    )

            elif result_type == "customers" and data:
                formatted.append("\n**Customers:**")
                for customer in data[:5]:
                    formatted.append(
                        f"- {customer['company_name']} ({customer['customer_number']}) - "
                        f"Contact: {customer['contact_name']} - Email: {customer['email']}"
                    )

            elif result_type == "orders" and data:
                formatted.append("\n**Orders:**")
                for order in data[:5]:
                    formatted.append(
                        f"- Order {order['order_number']} - "
                        f"Status: {order['status']} - Total: ${order['total']}"
                    )

        return "\n".join(formatted) if formatted else "No relevant data found."

    async def execute(
        self, task: str, context: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """
        Execute a chat task.

        Args:
            task: User message
            context: Optional context (conversation_id, user_id)

        Returns:
            Response dict with message and metadata
        """
        context = context or {}

        # Initialize state
        initial_state: ChatState = {
            "messages": [],
            "user_message": task,
            "conversation_id": context.get("conversation_id", str(uuid4())),
            "user_id": context.get("user_id"),
            "context": {},
            "tools": [t.name for t in self.tools],
            "response": None,
            "tools_used": [],
            "error": None,
            "metadata": {},
        }

        # Run the graph
        final_state = await self.graph.ainvoke(initial_state)

        return {
            "conversation_id": final_state["conversation_id"],
            "response": final_state["response"],
            "tools_used": final_state["tools_used"],
            "error": final_state["error"],
        }

    async def stream(
        self, task: str, context: dict[str, Any] | None = None
    ) -> AsyncGenerator[str, None]:
        """
        Stream a chat response.

        Args:
            task: User message
            context: Optional context

        Yields:
            Response chunks
        """
        # For now, execute normally and yield the full response
        # TODO: Implement true streaming with Ollama stream_chat
        result = await self.execute(task, context)
        if result["response"]:
            yield result["response"]
