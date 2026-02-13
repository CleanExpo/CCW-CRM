"""Phase 6 test runner — runs outside pytest to avoid conftest.py deps.

Uses importlib to load agent modules directly, with a mock BaseAgent
to avoid the database import chain (base_agent → database → asyncpg).
"""

import ast
import importlib.util as _ilu
import os
import sys
import types
from datetime import UTC, datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


# ---------------------------------------------------------------------------
# Mock BaseAgent so agent modules don't pull in database.py → asyncpg
# ---------------------------------------------------------------------------

class _MockBaseAgent:
    """Minimal stand-in for BaseAgent to allow class instantiation."""

    def __init__(self, name=None, auto_register=True, **kwargs):
        self.agent_id = "test-agent-id"
        self.name = name or self.__class__.__name__
        self.tools = []
        self.capabilities = []

    async def execute(self, task, context=None):
        return {}

    async def stream(self, task, context=None):
        yield ""

    def _log_execution_start(self, *a, **kw):
        pass

    def _log_execution_complete(self, *a, **kw):
        pass

    def _schedule_registration(self):
        pass


# Create a mock module for src.ai.base_agent
_mock_base_mod = types.ModuleType("src.ai.base_agent")
_mock_base_mod.BaseAgent = _MockBaseAgent
sys.modules["src.ai.base_agent"] = _mock_base_mod

# Also mock structlog to avoid any issues
if "structlog" not in sys.modules:
    _mock_structlog = types.ModuleType("structlog")
    class _MockLogger:
        def info(self, *a, **kw): pass
        def debug(self, *a, **kw): pass
        def warning(self, *a, **kw): pass
        def error(self, *a, **kw): pass
    _mock_structlog.get_logger = lambda *a, **kw: _MockLogger()
    sys.modules["structlog"] = _mock_structlog

# Mock sqlalchemy imports needed by agent modules
for mod_name in [
    "sqlalchemy", "sqlalchemy.ext", "sqlalchemy.ext.asyncio",
    "sqlalchemy.ext.asyncio.AsyncSession",
    "sqlalchemy.ext.asyncio",
]:
    if mod_name not in sys.modules:
        sys.modules[mod_name] = types.ModuleType(mod_name)

# Add missing attributes
if not hasattr(sys.modules["sqlalchemy"], "func"):
    sys.modules["sqlalchemy"].func = None
if not hasattr(sys.modules["sqlalchemy"], "select"):
    sys.modules["sqlalchemy"].select = lambda *a: None

# Now we can safely import the agent modules
_fc_spec = _ilu.spec_from_file_location(
    "cin7_forecasting_agent",
    os.path.join(_backend_dir, "src", "ai", "agents", "specialized", "cin7_forecasting_agent.py"),
)
_fc_mod = _ilu.module_from_spec(_fc_spec)
_fc_spec.loader.exec_module(_fc_mod)

calculate_sync_velocity = _fc_mod.calculate_sync_velocity
estimate_cin7_reorder_point = _fc_mod.estimate_cin7_reorder_point
detect_sync_seasonality = _fc_mod.detect_sync_seasonality
build_cin7_forecast = _fc_mod.build_cin7_forecast
Cin7ForecastingAgent = _fc_mod.Cin7ForecastingAgent

_an_spec = _ilu.spec_from_file_location(
    "cin7_anomaly_agent",
    os.path.join(_backend_dir, "src", "ai", "agents", "specialized", "cin7_anomaly_agent.py"),
)
_an_mod = _ilu.module_from_spec(_an_spec)
_an_spec.loader.exec_module(_an_mod)

detect_sync_frequency_anomaly = _an_mod.detect_sync_frequency_anomaly
detect_price_drift = _an_mod.detect_price_drift
detect_stock_mismatch = _an_mod.detect_stock_mismatch
calculate_sync_health_score = _an_mod.calculate_sync_health_score
detect_mapping_gaps = _an_mod.detect_mapping_gaps
Cin7AnomalyAgent = _an_mod.Cin7AnomalyAgent

passed = 0
failed = 0


def check(desc, condition):
    global passed, failed
    if condition:
        passed += 1
    else:
        failed += 1
        print(f"FAIL: {desc}")


# ============================================================
# calculate_sync_velocity — normal
# ============================================================

now = datetime.now(UTC)
sync_logs_normal = [
    {"synced_at": (now - timedelta(hours=12)).isoformat(), "records_processed": 10},
    {"synced_at": (now - timedelta(hours=8)).isoformat(), "records_processed": 15},
    {"synced_at": (now - timedelta(hours=4)).isoformat(), "records_processed": 20},
    {"synced_at": now.isoformat(), "records_processed": 25},
]

vel = calculate_sync_velocity(sync_logs_normal)
check("velocity syncs_per_day > 0", vel["syncs_per_day"] > 0)
check("velocity avg_changes > 0", vel["avg_changes"] > 0)
check("velocity trend is string", vel["trend"] in ("increasing", "decreasing", "stable"))

# Empty
vel_empty = calculate_sync_velocity([])
check("velocity empty syncs_per_day", vel_empty["syncs_per_day"] == 0.0)
check("velocity empty trend", vel_empty["trend"] == "stable")

# Single entry
vel_single = calculate_sync_velocity([
    {"synced_at": now.isoformat(), "records_processed": 5},
])
check("velocity single syncs_per_day", vel_single["syncs_per_day"] == 1.0)

# ============================================================
# estimate_cin7_reorder_point
# ============================================================

rp1 = estimate_cin7_reorder_point(2.5, 14, 1.5)
check("reorder point positive", rp1 > 0)
check("reorder point value", rp1 == 53)  # ceil(2.5 * 14 * 1.5) = ceil(52.5) = 53

rp_zero = estimate_cin7_reorder_point(0, 14, 1.5)
check("reorder point zero velocity", rp_zero == 0)

rp_small = estimate_cin7_reorder_point(0.1, 7, 1.0)
check("reorder point small", rp_small == 1)  # ceil(0.7) = 1

# ============================================================
# detect_sync_seasonality — pattern detected
# ============================================================

monthly_data = {
    "January": 5.0,
    "February": 4.0,
    "March": 15.0,
    "April": 12.0,
    "May": 8.0,
    "June": 3.0,
    "July": 2.0,
    "August": 6.0,
    "September": 14.0,
    "October": 10.0,
    "November": 7.0,
    "December": 3.0,
}

season = detect_sync_seasonality(monthly_data)
check("seasonality pattern detected", season["pattern_detected"] is True)
check("seasonality has peak months", len(season["peak_months"]) > 0)
check("seasonality has trough months", len(season["trough_months"]) > 0)

# Flat — no pattern
monthly_flat = {"January": 10.0, "February": 10.0, "March": 10.0, "April": 10.0}
season_flat = detect_sync_seasonality(monthly_flat)
check("seasonality flat no pattern", season_flat["pattern_detected"] is False)

# Empty
season_empty = detect_sync_seasonality({})
check("seasonality empty no pattern", season_empty["pattern_detected"] is False)

# Too few months
season_few = detect_sync_seasonality({"Jan": 5.0, "Feb": 3.0})
check("seasonality few no pattern", season_few["pattern_detected"] is False)

# ============================================================
# build_cin7_forecast — complete
# ============================================================

product_data = {
    "product_id": "prod-001",
    "product_name": "Excavator 320",
    "sku": "EX-320",
    "current_stock": 50,
}
velocity_data = {"syncs_per_day": 2.0, "avg_changes": 5.0, "trend": "stable"}

forecast = build_cin7_forecast(product_data, velocity_data, season)
check("forecast product_id", forecast["product_id"] == "prod-001")
check("forecast sku", forecast["sku"] == "EX-320")
check("forecast has days_until_depletion", forecast["forecast"]["days_until_depletion"] is not None)
check("forecast has reorder_point", forecast["forecast"]["reorder_point"] > 0)
check("forecast has confidence", 0 < forecast["confidence"] <= 1.0)

# Minimal — zero stock
product_zero = {"product_id": "prod-002", "current_stock": 0}
velocity_zero = {"syncs_per_day": 0, "avg_changes": 0, "trend": "stable"}
forecast_zero = build_cin7_forecast(product_zero, velocity_zero)
check("forecast zero depletion is None", forecast_zero["forecast"]["days_until_depletion"] is None)

# ============================================================
# detect_sync_frequency_anomaly — normal
# ============================================================

normal_times = [
    now - timedelta(seconds=1200),
    now - timedelta(seconds=900),
    now - timedelta(seconds=600),
    now - timedelta(seconds=300),
    now,
]

freq = detect_sync_frequency_anomaly(normal_times, 300)
check("freq normal no anomaly", freq["is_anomaly"] is False)
check("freq normal avg close to 300", 200 < freq["avg_interval_seconds"] < 400)

# Gap anomaly
gap_times = [
    now - timedelta(seconds=2400),
    now - timedelta(seconds=2100),
    now - timedelta(seconds=1800),
    now - timedelta(seconds=300),  # 1500s gap!
    now,
]

freq_gap = detect_sync_frequency_anomaly(gap_times, 300)
check("freq gap is anomaly", freq_gap["is_anomaly"] is True)
check("freq gap count > 0", freq_gap["gap_count"] > 0)

# Spike anomaly
spike_times = [
    now - timedelta(seconds=100),
    now - timedelta(seconds=80),
    now - timedelta(seconds=60),
    now - timedelta(seconds=40),
    now,
]

freq_spike = detect_sync_frequency_anomaly(spike_times, 300)
check("freq spike is anomaly", freq_spike["is_anomaly"] is True)
check("freq spike count > 0", freq_spike["spike_count"] > 0)

# ============================================================
# detect_price_drift
# ============================================================

drift_ok = detect_price_drift(100.0, 103.0, 5.0)
check("drift ok no anomaly", drift_ok["is_anomaly"] is False)
check("drift ok pct ~3", 2.5 < drift_ok["drift_pct"] < 3.5)

drift_high = detect_price_drift(100.0, 120.0, 5.0)
check("drift high is anomaly", drift_high["is_anomaly"] is True)
check("drift high direction", drift_high["direction"] == "cin7_higher")

drift_low = detect_price_drift(100.0, 80.0, 5.0)
check("drift low is anomaly", drift_low["is_anomaly"] is True)
check("drift low direction", drift_low["direction"] == "cin7_lower")

drift_zero = detect_price_drift(0.0, 0.0, 5.0)
check("drift zero no anomaly", drift_zero["is_anomaly"] is False)

# ============================================================
# detect_stock_mismatch
# ============================================================

sm_ok = detect_stock_mismatch(100, 103, 5)
check("stock match ok no anomaly", sm_ok["is_anomaly"] is False)
check("stock match ok diff", sm_ok["difference"] == 3)

sm_bad = detect_stock_mismatch(100, 50, 5)
check("stock mismatch is anomaly", sm_bad["is_anomaly"] is True)
check("stock mismatch diff", sm_bad["difference"] == 50)
check("stock mismatch severity high+", sm_bad["severity"] in ("high", "critical"))

sm_zero = detect_stock_mismatch(0, 0, 5)
check("stock zero no anomaly", sm_zero["is_anomaly"] is False)
check("stock zero diff", sm_zero["difference"] == 0)

# ============================================================
# calculate_sync_health_score — good
# ============================================================

health_good = calculate_sync_health_score(95, 5, 500.0)
check("health good score >= 80", health_good["score"] >= 80)
check("health good grade A or B", health_good["grade"] in ("A", "B"))

health_deg = calculate_sync_health_score(7, 3, 5000.0)
check("health degraded score", 30 <= health_deg["score"] <= 80)
check("health degraded has details", "success_rate" in health_deg["details"])

health_fail = calculate_sync_health_score(1, 9, 15000.0)
check("health fail score < 50", health_fail["score"] < 50)
check("health fail grade D or F", health_fail["grade"] in ("D", "F"))

health_zero = calculate_sync_health_score(0, 0, 0.0)
check("health zero score 0-20", health_zero["score"] <= 20)
check("health zero grade F", health_zero["grade"] == "F")

# ============================================================
# detect_mapping_gaps
# ============================================================

gaps_full = detect_mapping_gaps(100, 95)
check("gaps full coverage >= 90", gaps_full["coverage_pct"] >= 90)
check("gaps full severity low", gaps_full["severity"] == "low")

gaps_partial = detect_mapping_gaps(100, 60)
check("gaps partial coverage", gaps_partial["coverage_pct"] == 60.0)
check("gaps partial unmapped", gaps_partial["unmapped_count"] == 40)
check("gaps partial is anomaly", gaps_partial["is_anomaly"] is True)

gaps_empty = detect_mapping_gaps(0, 0)
check("gaps empty coverage 0", gaps_empty["coverage_pct"] == 0.0)
check("gaps empty not anomaly", gaps_empty["is_anomaly"] is False)

# ============================================================
# Agent class instantiation
# ============================================================

forecast_agent = Cin7ForecastingAgent()
check("forecast agent name", forecast_agent.name == "Cin7ForecastingAgent")
check("forecast agent capabilities", "cin7_forecasting" in forecast_agent.capabilities)

anomaly_agent = Cin7AnomalyAgent()
check("anomaly agent name", anomaly_agent.name == "Cin7AnomalyAgent")
check("anomaly agent capabilities", "cin7_anomaly_detection" in anomaly_agent.capabilities)

# ============================================================
# AST verification — cin7_forecast.py endpoints
# ============================================================

with open(os.path.join(_backend_dir, "src", "api", "routes", "ai", "cin7_forecast.py")) as fh:
    tree_fc = ast.parse(fh.read())

fc_funcs = [n.name for n in ast.walk(tree_fc) if isinstance(n, ast.AsyncFunctionDef)]
for expected in [
    "forecast_cin7_demand",
    "get_cin7_sync_velocity",
    "get_cin7_forecast_health",
]:
    check(f"forecast endpoint {expected}", expected in fc_funcs)

# ============================================================
# AST verification — cin7_anomaly.py endpoints
# ============================================================

with open(os.path.join(_backend_dir, "src", "api", "routes", "ai", "cin7_anomaly.py")) as fh:
    tree_an = ast.parse(fh.read())

an_funcs = [n.name for n in ast.walk(tree_an) if isinstance(n, ast.AsyncFunctionDef)]
for expected in [
    "detect_cin7_anomalies",
    "get_cin7_sync_health",
    "get_cin7_anomaly_health",
]:
    check(f"anomaly endpoint {expected}", expected in an_funcs)


print(f"Phase 6 AI Agents tests: {passed} passed, {failed} failed")
sys.exit(1 if failed > 0 else 0)
