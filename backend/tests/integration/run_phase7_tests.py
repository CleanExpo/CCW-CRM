"""Phase 7 test runner — validates frontend files exist + backend AI endpoints.

Tests:
  - AST verification of cin7_forecast.py endpoints (3)
  - AST verification of cin7_anomaly.py endpoints (3)
  - Frontend file existence checks (6)
  - Frontend integrations page imports Cin7 components (2)
  - Dashboard page imports Cin7SyncStatusWidget (1)
"""

import ast
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_web_dir = os.path.abspath(os.path.join(_backend_dir, "..", "web"))

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
# Backend AI Endpoint Verification
# ============================================================

# cin7_forecast.py endpoints
with open(os.path.join(_backend_dir, "src", "api", "routes", "ai", "cin7_forecast.py")) as fh:
    tree_fc = ast.parse(fh.read())

fc_funcs = [n.name for n in ast.walk(tree_fc) if isinstance(n, ast.AsyncFunctionDef)]
for expected in ["forecast_cin7_demand", "get_cin7_sync_velocity", "get_cin7_forecast_health"]:
    check(f"p7 forecast endpoint {expected}", expected in fc_funcs)

# cin7_anomaly.py endpoints
with open(os.path.join(_backend_dir, "src", "api", "routes", "ai", "cin7_anomaly.py")) as fh:
    tree_an = ast.parse(fh.read())

an_funcs = [n.name for n in ast.walk(tree_an) if isinstance(n, ast.AsyncFunctionDef)]
for expected in ["detect_cin7_anomalies", "get_cin7_sync_health", "get_cin7_anomaly_health"]:
    check(f"p7 anomaly endpoint {expected}", expected in an_funcs)

# ============================================================
# Frontend File Existence
# ============================================================

frontend_files = [
    os.path.join(_web_dir, "lib", "api", "cin7.ts"),
    os.path.join(_web_dir, "lib", "hooks", "use-cin7-stream.ts"),
    os.path.join(_web_dir, "app", "(dashboard)", "settings", "integrations", "components", "Cin7ConnectionCard.tsx"),
    os.path.join(_web_dir, "app", "(dashboard)", "settings", "integrations", "components", "Cin7SyncControls.tsx"),
    os.path.join(_web_dir, "components", "dashboard", "Cin7SyncStatusWidget.tsx"),
    os.path.join(_web_dir, "app", "(dashboard)", "dashboard", "page.tsx"),
]

for fpath in frontend_files:
    fname = os.path.basename(fpath)
    check(f"p7 file exists {fname}", os.path.isfile(fpath))

# ============================================================
# Frontend Integration Verification
# ============================================================

# Check integrations page imports Cin7 components
integrations_page = os.path.join(
    _web_dir, "app", "(dashboard)", "settings", "integrations", "page.tsx"
)
with open(integrations_page, encoding="utf-8") as fh:
    int_content = fh.read()

check("p7 integrations imports Cin7ConnectionCard", "Cin7ConnectionCard" in int_content)
check("p7 integrations imports Cin7SyncControls", "Cin7SyncControls" in int_content)

# Check dashboard page imports Cin7SyncStatusWidget
dashboard_page = os.path.join(
    _web_dir, "app", "(dashboard)", "dashboard", "page.tsx"
)
with open(dashboard_page, encoding="utf-8") as fh:
    dash_content = fh.read()

check("p7 dashboard imports Cin7SyncStatusWidget", "Cin7SyncStatusWidget" in dash_content)

# ============================================================
# Summary
# ============================================================

print(f"\nPhase 7 Frontend + AI tests: {passed} passed, {failed} failed")
sys.exit(1 if failed > 0 else 0)
