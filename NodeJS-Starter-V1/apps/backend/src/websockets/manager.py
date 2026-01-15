"""
WebSocket Connection Manager with Redis Pub/Sub.

Handles WebSocket connections and broadcasts messages via Redis pub/sub
for horizontal scaling across multiple server instances.
"""

import asyncio
import json
import logging
from typing import Dict, Set
from datetime import datetime

from fastapi import WebSocket
import redis.asyncio as redis

from src.config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ConnectionManager:
    """
    Manages WebSocket connections and message broadcasting.

    Features:
    - Connection pooling and lifecycle management
    - Redis pub/sub for multi-instance message broadcasting
    - Channel-based routing (e.g., "orders", "inventory", "notifications")
    - Automatic reconnection handling
    - Connection health checks
    """

    def __init__(self):
        """Initialize connection manager."""
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.client_channels: Dict[str, Set[str]] = {}  # client_id -> set of channels
        self.redis_client: redis.Redis | None = None
        self.pubsub: redis.client.PubSub | None = None
        self.listener_task: asyncio.Task | None = None
        logger.info("WebSocket Connection Manager initialized")

    async def connect(self, websocket: WebSocket, client_id: str):
        """
        Accept and register a new WebSocket connection.

        Args:
            websocket: FastAPI WebSocket instance
            client_id: Unique client identifier
        """
        await websocket.accept()

        # Initialize client's channel set if not exists
        if client_id not in self.active_connections:
            self.active_connections[client_id] = set()
            self.client_channels[client_id] = set()

        # Add connection
        self.active_connections[client_id].add(websocket)

        # Start Redis listener if not already running
        if not self.listener_task or self.listener_task.done():
            await self._start_redis_listener()

        logger.info(f"Client {client_id} connected (total connections: {self._count_connections()})")

        # Send welcome message
        await self.send_personal_message(
            {
                "type": "connection",
                "status": "connected",
                "client_id": client_id,
                "timestamp": datetime.utcnow().isoformat(),
            },
            websocket
        )

    def disconnect(self, websocket: WebSocket, client_id: str):
        """
        Remove a WebSocket connection.

        Args:
            websocket: FastAPI WebSocket instance
            client_id: Client identifier
        """
        if client_id in self.active_connections:
            self.active_connections[client_id].discard(websocket)

            # Remove client entry if no more connections
            if not self.active_connections[client_id]:
                del self.active_connections[client_id]
                if client_id in self.client_channels:
                    del self.client_channels[client_id]

        logger.info(f"Client {client_id} disconnected (total connections: {self._count_connections()})")

    async def subscribe_to_channel(self, client_id: str, channel: str):
        """
        Subscribe a client to a specific channel.

        Args:
            client_id: Client identifier
            channel: Channel name (e.g., "orders", "inventory")
        """
        if client_id not in self.client_channels:
            self.client_channels[client_id] = set()

        self.client_channels[client_id].add(channel)
        logger.info(f"Client {client_id} subscribed to channel: {channel}")

    async def unsubscribe_from_channel(self, client_id: str, channel: str):
        """
        Unsubscribe a client from a channel.

        Args:
            client_id: Client identifier
            channel: Channel name
        """
        if client_id in self.client_channels:
            self.client_channels[client_id].discard(channel)
            logger.info(f"Client {client_id} unsubscribed from channel: {channel}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """
        Send a message to a specific WebSocket connection.

        Args:
            message: Dictionary message to send
            websocket: Target WebSocket connection
        """
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Failed to send personal message: {e}")

    async def broadcast_to_channel(self, channel: str, message: dict):
        """
        Broadcast a message to all clients subscribed to a channel.

        This publishes to Redis pub/sub, which will be picked up by all server instances.

        Args:
            channel: Channel name
            message: Message dictionary
        """
        # Add metadata
        message_with_metadata = {
            **message,
            "channel": channel,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Publish to Redis for multi-instance broadcasting
        try:
            if not self.redis_client:
                self.redis_client = await redis.from_url(
                    settings.redis_url,
                    encoding="utf-8",
                    decode_responses=True
                )

            await self.redis_client.publish(
                f"ws:{channel}",
                json.dumps(message_with_metadata)
            )
            logger.debug(f"Published message to channel {channel}")
        except Exception as e:
            logger.error(f"Failed to publish to Redis: {e}")
            # Fallback to local broadcast
            await self._broadcast_local(channel, message_with_metadata)

    async def _broadcast_local(self, channel: str, message: dict):
        """
        Broadcast message to local WebSocket connections only.

        Args:
            channel: Channel name
            message: Message dictionary
        """
        disconnected_clients = []

        for client_id, channels in self.client_channels.items():
            if channel in channels:
                if client_id in self.active_connections:
                    for websocket in list(self.active_connections[client_id]):
                        try:
                            await websocket.send_json(message)
                        except Exception as e:
                            logger.error(f"Failed to send to client {client_id}: {e}")
                            disconnected_clients.append((websocket, client_id))

        # Clean up disconnected clients
        for websocket, client_id in disconnected_clients:
            self.disconnect(websocket, client_id)

    async def _start_redis_listener(self):
        """Start listening to Redis pub/sub channels."""
        try:
            if not self.redis_client:
                self.redis_client = await redis.from_url(
                    settings.redis_url,
                    encoding="utf-8",
                    decode_responses=True
                )

            self.pubsub = self.redis_client.pubsub()

            # Subscribe to all WebSocket channels
            await self.pubsub.psubscribe("ws:*")

            # Start listener task
            self.listener_task = asyncio.create_task(self._redis_listener())
            logger.info("Redis pub/sub listener started")
        except Exception as e:
            logger.error(f"Failed to start Redis listener: {e}")

    async def _redis_listener(self):
        """
        Listen for messages from Redis pub/sub and broadcast to local connections.
        """
        try:
            while True:
                message = await self.pubsub.get_message(ignore_subscribe_messages=True)
                if message and message["type"] == "pmessage":
                    # Extract channel name (remove "ws:" prefix)
                    channel = message["channel"].replace("ws:", "")
                    data = json.loads(message["data"])

                    # Broadcast to local connections subscribed to this channel
                    await self._broadcast_local(channel, data)

                await asyncio.sleep(0.01)  # Small delay to prevent busy loop
        except asyncio.CancelledError:
            logger.info("Redis listener task cancelled")
        except Exception as e:
            logger.error(f"Redis listener error: {e}")
            # Restart listener after delay
            await asyncio.sleep(5)
            await self._start_redis_listener()

    async def broadcast_to_all(self, message: dict):
        """
        Broadcast a message to ALL connected clients (no channel filtering).

        Args:
            message: Message dictionary
        """
        message_with_metadata = {
            **message,
            "timestamp": datetime.utcnow().isoformat(),
        }

        disconnected_clients = []

        for client_id, connections in self.active_connections.items():
            for websocket in list(connections):
                try:
                    await websocket.send_json(message_with_metadata)
                except Exception as e:
                    logger.error(f"Failed to send to client {client_id}: {e}")
                    disconnected_clients.append((websocket, client_id))

        # Clean up disconnected clients
        for websocket, client_id in disconnected_clients:
            self.disconnect(websocket, client_id)

    def _count_connections(self) -> int:
        """Count total active WebSocket connections."""
        return sum(len(conns) for conns in self.active_connections.values())

    async def close_all(self):
        """Close all WebSocket connections and cleanup resources."""
        # Close all connections
        for client_id, connections in list(self.active_connections.items()):
            for websocket in list(connections):
                try:
                    await websocket.close()
                except Exception as e:
                    logger.error(f"Error closing websocket for client {client_id}: {e}")

        # Cancel listener task
        if self.listener_task and not self.listener_task.done():
            self.listener_task.cancel()
            try:
                await self.listener_task
            except asyncio.CancelledError:
                pass

        # Close Redis connections
        if self.pubsub:
            await self.pubsub.unsubscribe()
            await self.pubsub.close()

        if self.redis_client:
            await self.redis_client.close()

        logger.info("All WebSocket connections closed")


# Global singleton instance
manager = ConnectionManager()
