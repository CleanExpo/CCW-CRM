"""Run all service tests without pytest conftest issues."""
import sys

sys.path.insert(0, '.')

from tests.services.test_auto_reorder import (
    TestApplyQuantityBreaks,
    TestCalculateExpectedDelivery,
    TestCalculateReorderQuantity,
    TestGeneratePoNumber,
    TestShouldReorder,
)
from tests.services.test_dunning import (
    TestCalculateDaysOverdue,
    TestGenerateDunningLetter,
    TestGetDunningLevel,
    TestGetDunningSchedule,
    TestShouldSendDunningPure,
)
from tests.services.test_order_state import (
    TestCanTransition,
    TestGetNextStates,
    TestGetStateLifecycle,
    TestIsTerminalState,
    TestValidateTransition,
)
from tests.services.test_procurement_matching import (
    TestGetVarianceSummary,
    TestIsVarianceAcceptable,
    TestMatchPoGrnInvoice,
)
from tests.services.test_sla_escalation import (
    TestBuildEscalationMessage,
    TestCalculateEscalationLevel,
    TestCalculateHoursOverdue,
    TestGetEscalationAssignee,
    TestIsSlaBreached,
    TestShouldEscalate,
)
from tests.services.test_tax_calculator import (
    TestCalculateReverseTax,
    TestCalculateTax,
    TestGetTaxRateInfo,
    TestTaxBreakdown,
)


def run_test_class(test_class, class_name):
    """Run all tests in a test class."""
    tests = [method for method in dir(test_class) if method.startswith('test_')]
    passed = 0
    failed = 0

    for test_name in tests:
        try:
            test_obj = test_class()
            getattr(test_obj, test_name)()
            passed += 1
        except AssertionError as e:
            print(f'  [FAIL] {class_name}.{test_name}: {str(e)[:80]}')
            failed += 1
        except Exception as e:
            print(f'  [ERROR] {class_name}.{test_name}: {str(e)[:80]}')
            failed += 1

    return passed, failed


def main():
    """Run all service tests."""
    test_classes = [
        # GAP-026: Procurement Matching
        (TestMatchPoGrnInvoice, 'TestMatchPoGrnInvoice'),
        (TestGetVarianceSummary, 'TestGetVarianceSummary'),
        (TestIsVarianceAcceptable, 'TestIsVarianceAcceptable'),

        # GAP-027: Order State Machine
        (TestCanTransition, 'TestCanTransition'),
        (TestGetNextStates, 'TestGetNextStates'),
        (TestValidateTransition, 'TestValidateTransition'),
        (TestGetStateLifecycle, 'TestGetStateLifecycle'),
        (TestIsTerminalState, 'TestIsTerminalState'),

        # GAP-028: Tax Calculator
        (TestCalculateTax, 'TestCalculateTax'),
        (TestCalculateReverseTax, 'TestCalculateReverseTax'),
        (TestGetTaxRateInfo, 'TestGetTaxRateInfo'),
        (TestTaxBreakdown, 'TestTaxBreakdown'),

        # GAP-029: Dunning
        (TestGetDunningLevel, 'TestGetDunningLevel'),
        (TestCalculateDaysOverdue, 'TestCalculateDaysOverdue'),
        (TestGenerateDunningLetter, 'TestGenerateDunningLetter'),
        (TestShouldSendDunningPure, 'TestShouldSendDunningPure'),
        (TestGetDunningSchedule, 'TestGetDunningSchedule'),

        # GAP-030: Auto-Reorder
        (TestCalculateReorderQuantity, 'TestCalculateReorderQuantity'),
        (TestShouldReorder, 'TestShouldReorder'),
        (TestGeneratePoNumber, 'TestGeneratePoNumber'),
        (TestCalculateExpectedDelivery, 'TestCalculateExpectedDelivery'),
        (TestApplyQuantityBreaks, 'TestApplyQuantityBreaks'),

        # GAP-031: SLA Escalation
        (TestIsSlaBreached, 'TestIsSlaBreached'),
        (TestCalculateHoursOverdue, 'TestCalculateHoursOverdue'),
        (TestCalculateEscalationLevel, 'TestCalculateEscalationLevel'),
        (TestGetEscalationAssignee, 'TestGetEscalationAssignee'),
        (TestBuildEscalationMessage, 'TestBuildEscalationMessage'),
        (TestShouldEscalate, 'TestShouldEscalate'),
    ]

    total_passed = 0
    total_failed = 0

    print('=' * 80)
    print('PHASE 3: BUSINESS LOGIC SERVICES TEST SUITE')
    print('=' * 80)
    print()

    for test_class, class_name in test_classes:
        passed, failed = run_test_class(test_class, class_name)
        total_passed += passed
        total_failed += failed

        if failed == 0:
            print(f'  [{passed:2d} tests] {class_name}')

    print()
    print('=' * 80)
    print(f'TOTAL: {total_passed} passed, {total_failed} failed')
    print('=' * 80)

    if total_failed > 0:
        sys.exit(1)
    else:
        print()
        print('All 6 business logic services: TESTS PASSING')
        print('GAP-026: Procurement Matching - DONE')
        print('GAP-027: Order State Machine - DONE')
        print('GAP-028: Tax Calculator - DONE')
        print('GAP-029: Dunning Automation - DONE')
        print('GAP-030: Auto-Reorder - DONE')
        print('GAP-031: SLA Escalation - DONE')
        sys.exit(0)


if __name__ == '__main__':
    main()
