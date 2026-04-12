# CCW-Online ERP - UAT Stakeholders

**UAT Period**: February 5-12, 2026
**Status**: Ready for Scheduling

---

## Primary Stakeholders (Required)

### Business Owner

- **Name**: ********\_\_\_********
- **Role**: Final Approval Authority
- **Email**: ********\_\_\_********
- **Availability**: ********\_\_\_********
- **Session Scheduled**: [ ] Not Scheduled | Date/Time: ****\_\_****
- **Focus Areas**:
  - Overall system usability
  - Strategic business features
  - Final production deployment approval
- **Test Cases**: All modules overview + Business Workflows
- **Duration**: 1 hour

---

### Sales Manager

- **Name**: ********\_\_\_********
- **Role**: Quote and Order Workflows
- **Email**: ********\_\_\_********
- **Availability**: ********\_\_\_********
- **Session Scheduled**: [ ] Not Scheduled | Date/Time: ****\_\_****
- **Focus Areas**:
  - Quotes Module (all 10 test cases)
  - Orders Module (all 10 test cases)
  - Customers Module (customer management)
  - Quote-to-Order conversion workflow
- **Test Cases**: TC-Q001-Q010, TC-O001-O010, TC-C001-C007, Workflow 1
- **Duration**: 1 hour

---

### Warehouse Manager

- **Name**: ********\_\_\_********
- **Role**: Inventory and Order Fulfillment
- **Email**: ********\_\_\_********
- **Availability**: ********\_\_\_********
- **Session Scheduled**: [ ] Not Scheduled | Date/Time: ****\_\_****
- **Focus Areas**:
  - Products Module (all 8 test cases)
  - Orders Module (fulfillment workflow)
  - Inventory management
  - Stock tracking
- **Test Cases**: TC-P001-P008, TC-O001-O010, Workflow 2, Workflow 5
- **Duration**: 1 hour

---

### Customer Service Lead

- **Name**: ********\_\_\_********
- **Role**: Customer Support and Portal
- **Email**: ********\_\_\_********
- **Availability**: ********\_\_\_********
- **Session Scheduled**: [ ] Not Scheduled | Date/Time: ****\_\_****
- **Focus Areas**:
  - Customers Module (all 7 test cases)
  - Orders Module (order tracking)
  - Customer portal (if applicable)
  - Customer order history
- **Test Cases**: TC-C001-C007, TC-O001-O010, Workflow 3, Workflow 4
- **Duration**: 1 hour

---

## Secondary Stakeholders (Optional but Recommended)

### Finance/Accounting

- **Name**: ********\_\_\_********
- **Role**: Financial Data Accuracy
- **Email**: ********\_\_\_********
- **Availability**: ********\_\_\_********
- **Session Scheduled**: [ ] Not Scheduled | Date/Time: ****\_\_****
- **Focus Areas**:
  - Order totals accuracy
  - Quote totals accuracy
  - Reporting accuracy
- **Duration**: 30 minutes (optional)

---

### IT/Technical Lead

- **Name**: ********\_\_\_********
- **Role**: System Stability and Performance
- **Email**: ********\_\_\_********
- **Availability**: ********\_\_\_********
- **Session Scheduled**: [ ] Not Scheduled | Date/Time: ****\_\_****
- **Focus Areas**:
  - System performance observations
  - Error handling
  - Technical issues
- **Duration**: Observer role during sessions

---

### End Users (Representatives)

- **Names**: ********\_\_\_********
- **Roles**: Daily Operations
- **Email**: ********\_\_\_********
- **Availability**: ********\_\_\_********
- **Session Scheduled**: [ ] Not Scheduled | Date/Time: ****\_\_****
- **Focus Areas**:
  - Day-to-day usability
  - Workflow efficiency
  - User experience feedback
- **Duration**: 30 minutes (optional)

---

## UAT Session Schedule

| Session # | Stakeholder           | Date | Time | Duration | Location          | Status      |
| --------- | --------------------- | ---- | ---- | -------- | ----------------- | ----------- |
| Session 1 | Sales Manager         | TBD  | TBD  | 1 hour   | Virtual/In-Person | ☐ Scheduled |
| Session 2 | Warehouse Manager     | TBD  | TBD  | 1 hour   | Virtual/In-Person | ☐ Scheduled |
| Session 3 | Customer Service Lead | TBD  | TBD  | 1 hour   | Virtual/In-Person | ☐ Scheduled |
| Session 4 | Business Owner        | TBD  | TBD  | 1 hour   | Virtual/In-Person | ☐ Scheduled |

**Total Scheduled Time**: 4 hours (primary stakeholders)

---

## UAT Environment Access

### Frontend Access

- **URL**: http://localhost:3000
- **Environment**: Local Development (UAT Configuration)

### Backend API Access

- **URL**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs (Swagger UI)

### Test Credentials

**Admin/Business Owner**:

- Email: admin@demo.com
- Password: demo123
- Role: Administrator (full access)

**Sales User**:

- Email: sales@demo.com
- Password: demo123
- Role: Sales (quotes, orders, customers access)

**Warehouse User**:

- Email: warehouse@demo.com
- Password: demo123
- Role: Warehouse (products, inventory, orders access)

**Note**: All stakeholders should use credentials matching their role for realistic testing.

---

## Communication Plan

### Before UAT Sessions

- **1 Week Prior**: Send calendar invites to all stakeholders
- **3 Days Prior**: Distribute UAT test cases document (UAT_TEST_CASES.md)
- **1 Day Prior**: Send reminder email with access instructions and credentials
- **1 Hour Prior**: Verify UAT environment is running and accessible

### During UAT Sessions

- **Session Facilitator**: ********\_\_\_********
- **Technical Support**: ********\_\_\_********
- **Note Taker**: ********\_\_\_********

### After UAT Sessions

- **Immediate**: Compile session notes in UAT_SESSION_LOG.md
- **Same Day**: Document issues in UAT_ISSUES.md
- **Within 24 Hours**: Prioritize and assign critical issues
- **Within 48 Hours**: Present UAT summary to business owner

---

## Stakeholder Responsibilities

### Stakeholders Should:

- ✅ Attend scheduled UAT session
- ✅ Follow test cases provided
- ✅ Provide honest feedback (positive and negative)
- ✅ Report any issues or concerns immediately
- ✅ Ask questions if instructions unclear
- ✅ Think about real-world usage scenarios
- ✅ Participate in sign-off decision

### Stakeholders Should NOT:

- ❌ Rush through test cases
- ❌ Skip test cases without reason
- ❌ Withhold negative feedback
- ❌ Test outside assigned test cases without notifying facilitator
- ❌ Make assumptions about how features should work

---

## Escalation Process

### For Critical Issues During UAT:

1. **Identify**: Tester identifies blocking issue
2. **Document**: Facilitator documents in UAT_ISSUES.md with "Critical" priority
3. **Notify**: Development team notified immediately
4. **Pause**: Pause affected test cases
5. **Fix**: Development team resolves issue (target: <2 hours)
6. **Re-test**: Stakeholder re-tests fixed issue
7. **Continue**: Resume UAT session

### For Non-Critical Issues:

1. Document in UAT_ISSUES.md with appropriate priority
2. Continue with remaining test cases
3. Address during issue resolution phase

---

## Success Metrics

- ✅ **All 4 Primary Stakeholders Participate**: Required for sign-off
- ✅ **90%+ Test Case Pass Rate**: Minimum 32 of 35 test cases passing
- ✅ **All Critical Issues Resolved**: Zero critical/blocker issues remain
- ✅ **Business Workflows Validated**: All 5 workflows complete successfully
- ✅ **Stakeholder Approval**: Majority approval from stakeholders
- ✅ **Business Owner Sign-Off**: Final approval obtained

---

## Contact Information

### UAT Coordination

- **UAT Lead**: ********\_\_\_********
- **Email**: ********\_\_\_********
- **Phone**: ********\_\_\_********

### Technical Support

- **Development Lead**: ********\_\_\_********
- **Email**: ********\_\_\_********
- **Phone**: ********\_\_\_********

### Business Owner

- **Name**: ********\_\_\_********
- **Email**: ********\_\_\_********
- **Phone**: ********\_\_\_********

---

**Document Version**: 1.0
**Last Updated**: February 5, 2026
**Status**: Ready for stakeholder identification and scheduling
