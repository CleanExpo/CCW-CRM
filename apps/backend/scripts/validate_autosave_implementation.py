"""
Validate autosave implementation across all 7 forms.

Checks:
1. useAutosave hook imported
2. DraftRecoveryAlert component imported
3. Autosave hook properly configured
4. clearDraft() called on success
5. Draft recovery UI present
"""
import io
import sys
from pathlib import Path

# Force UTF-8 output to handle emojis
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

web_path = Path(__file__).parent.parent.parent / "web"
forms_path = web_path / "app" / "(dashboard)"

print("=" * 80)
print("AUTOSAVE IMPLEMENTATION VALIDATION")
print("=" * 80)

# Define all forms to check
forms_to_check = [
    {
        "name": "OrderForm",
        "path": forms_path / "orders" / "components" / "OrderForm.tsx",
        "has_line_items": True,
    },
    {
        "name": "QuoteForm",
        "path": forms_path / "quotes" / "components" / "QuoteForm.tsx",
        "has_line_items": True,
    },
    {
        "name": "CustomerForm",
        "path": forms_path / "customers" / "components" / "CustomerForm.tsx",
        "has_line_items": False,
    },
    {
        "name": "ProductForm",
        "path": forms_path / "products" / "components" / "ProductForm.tsx",
        "has_line_items": False,
    },
    {
        "name": "PurchaseOrderForm",
        "path": forms_path / "purchase-orders" / "components" / "PurchaseOrderForm.tsx",
        "has_line_items": True,
    },
    {
        "name": "SupplierForm",
        "path": forms_path / "suppliers" / "components" / "SupplierForm.tsx",
        "has_line_items": False,
    },
    {
        "name": "OutboundShipmentForm",
        "path": forms_path / "shipments" / "components" / "OutboundShipmentForm.tsx",
        "has_line_items": False,
    },
]

all_pass = True
results = []

for form_info in forms_to_check:
    form_name = form_info["name"]
    form_path = form_info["path"]
    has_line_items = form_info["has_line_items"]

    print(f"\n[CHECKING] {form_name}")
    print(f"  Path: {form_path.relative_to(web_path)}")

    if not form_path.exists():
        print("  [FAIL] File not found!")
        all_pass = False
        results.append((form_name, "FAIL", "File not found"))
        continue

    with open(form_path, "r", encoding="utf-8") as f:
        content = f.read()

    checks_passed = []
    checks_failed = []

    # Check 1: useAutosave import
    if 'from "@/lib/hooks/use-autosave"' in content or 'import { useAutosave }' in content:
        checks_passed.append("useAutosave imported")
    else:
        checks_failed.append("useAutosave NOT imported")

    # Check 2: DraftRecoveryAlert import
    if 'from "@/components/ui/draft-recovery-alert"' in content or 'import { DraftRecoveryAlert }' in content:
        checks_passed.append("DraftRecoveryAlert imported")
    else:
        checks_failed.append("DraftRecoveryAlert NOT imported")

    # Check 3: useAutosave hook usage
    if "useAutosave({" in content or "useAutosave<" in content:
        checks_passed.append("useAutosave hook configured")
    else:
        checks_failed.append("useAutosave hook NOT configured")

    # Check 4: hasDraft destructuring
    if "hasDraft" in content and "loadDraft" in content and "clearDraft" in content:
        checks_passed.append("Draft functions destructured")
    else:
        checks_failed.append("Draft functions NOT destructured")

    # Check 5: clearDraft() called
    if "clearDraft();" in content or "clearDraft()" in content:
        checks_passed.append("clearDraft() called")
    else:
        checks_failed.append("clearDraft() NOT called")

    # Check 6: DraftRecoveryAlert component used
    if "<DraftRecoveryAlert" in content:
        checks_passed.append("DraftRecoveryAlert component present")
    else:
        checks_failed.append("DraftRecoveryAlert component MISSING")

    # Check 7: savedAt prop passed
    if "savedAt={" in content:
        checks_passed.append("savedAt prop configured")
    else:
        checks_failed.append("savedAt prop MISSING")

    # Check 8: onRestore callback
    if "onRestore" in content:
        checks_passed.append("onRestore callback present")
    else:
        checks_failed.append("onRestore callback MISSING")

    # Check 9: Line items handling (for complex forms)
    if has_line_items:
        if "lineItems" in content and ("setLineItems" in content or "line_items" in content):
            checks_passed.append("Line items handling present")
        else:
            checks_failed.append("Line items handling MISSING")

    # Check 10: Debounce configured
    if "debounceMs" in content:
        checks_passed.append("debounceMs configured")
    else:
        checks_failed.append("debounceMs NOT configured")

    # Print results
    if checks_failed:
        print(f"  [FAIL] {len(checks_failed)} issues found:")
        for issue in checks_failed:
            print(f"    ❌ {issue}")
        all_pass = False
        results.append((form_name, "FAIL", f"{len(checks_failed)} issues"))
    else:
        print(f"  [PASS] All {len(checks_passed)} checks passed")
        for check in checks_passed[:3]:  # Show first 3
            print(f"    ✅ {check}")
        print(f"    ✅ ... and {len(checks_passed) - 3} more")
        results.append((form_name, "PASS", f"{len(checks_passed)} checks"))

# Summary
print("\n" + "=" * 80)
print("VALIDATION SUMMARY")
print("=" * 80)

passed = [r for r in results if r[1] == "PASS"]
failed = [r for r in results if r[1] == "FAIL"]

print(f"\n✅ Passed: {len(passed)}/{len(results)}")
for form_name, status, details in passed:
    print(f"  - {form_name}: {details}")

if failed:
    print(f"\n❌ Failed: {len(failed)}/{len(results)}")
    for form_name, status, details in failed:
        print(f"  - {form_name}: {details}")

# Check infrastructure files
print("\n" + "=" * 80)
print("INFRASTRUCTURE CHECK")
print("=" * 80)

infra_checks = []

# Check useAutosave hook exists
autosave_hook = web_path / "lib" / "hooks" / "use-autosave.ts"
if autosave_hook.exists():
    print("[PASS] useAutosave hook exists")
    infra_checks.append(True)
else:
    print("[FAIL] useAutosave hook MISSING")
    infra_checks.append(False)
    all_pass = False

# Check DraftStorage utility exists
draft_storage = web_path / "lib" / "utils" / "draft-storage.ts"
if draft_storage.exists():
    print("[PASS] DraftStorage utility exists")
    infra_checks.append(True)
else:
    print("[FAIL] DraftStorage utility MISSING")
    infra_checks.append(False)
    all_pass = False

# Check DraftRecoveryAlert component exists
recovery_alert = web_path / "components" / "ui" / "draft-recovery-alert.tsx"
if recovery_alert.exists():
    print("[PASS] DraftRecoveryAlert component exists")
    infra_checks.append(True)
else:
    print("[FAIL] DraftRecoveryAlert component MISSING")
    infra_checks.append(False)
    all_pass = False

# Final result
print("\n" + "=" * 80)
if all_pass:
    print("✅ ALL VALIDATIONS PASSED")
    print("=" * 80)
    print("\nAutosave system is correctly implemented across all forms!")
    print(f"\n✅ Forms: {len(passed)}/{len(results)}")
    print(f"✅ Infrastructure: {sum(infra_checks)}/{len(infra_checks)}")
    print("\n🎉 Ready for manual testing!")
    print("\nNext steps:")
    print("1. Start frontend: cd apps/web && pnpm dev")
    print("2. Follow manual testing guide in PHASE4-AUTOSAVE-TESTING.md")
    print("3. Test each form's draft save/restore functionality")
    sys.exit(0)
else:
    print("❌ VALIDATION FAILED")
    print("=" * 80)
    print("\nSome checks did not pass. Review failures above.")
    print(f"\n❌ Forms: {len(failed)}/{len(results)} failed")
    print(f"❌ Infrastructure: {len(infra_checks) - sum(infra_checks)}/{len(infra_checks)} missing")
    print("\nFix issues before manual testing.")
    sys.exit(1)
