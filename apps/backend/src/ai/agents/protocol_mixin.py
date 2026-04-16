"""Protocol mixin for uniform agent task dispatch.

Adds protocol_execute() to any agent class so the /api/agents/execute
endpoint can call any agent without knowing its specific method name.
"""


class ProtocolMixin:
    """Mixin that provides a uniform protocol_execute() entry point."""

    async def protocol_execute(self, task: dict) -> dict:
        """Dispatch a task to the agent's main callable method.

        Args:
            task: {"action": str, "params": dict}
                  action  – preferred method name (falls back to execute/run/generate)
                  params  – keyword arguments forwarded to the resolved method

        Returns:
            On success: {"agent": str, "action": str, "result": Any, "status": "ok"}
            On failure: {"status": "error", "error": str}
        """
        action = task.get("action", "execute")
        params = task.get("params", {})

        method = (
            getattr(self, action, None)
            or getattr(self, "execute", None)
            or getattr(self, "run", None)
            or getattr(self, "generate", None)
        )

        if method is None or not callable(method):
            return {
                "status": "error",
                "error": f"No callable method found for action='{action}'",
            }

        try:
            result = await method(**params) if params else await method()
            return {
                "agent": getattr(self, "AGENT_CARD", {}).get("name", type(self).__name__),
                "action": action,
                "result": result,
                "status": "ok",
            }
        except Exception as e:  # noqa: BLE001
            return {"status": "error", "error": str(e)}
