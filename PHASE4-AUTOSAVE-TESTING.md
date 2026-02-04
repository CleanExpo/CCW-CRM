# Phase 4: Autosave System - Testing Guide

## 🎯 Testing Overview

This guide covers comprehensive testing of the autosave and draft recovery system across all 7 forms.

**Test Duration:** ~30-45 minutes for full manual testing
**Forms to Test:** 7 (Orders, Quotes, Customers, Products, POs, Suppliers, Shipments)
**Critical Paths:** 5 key scenarios per form

---

## ✅ Pre-Test Validation

Before manual testing, run the validation script:

```bash
cd "C:\CCW-Online ERP\apps\backend"
python scripts/validate_autosave_implementation.py
```

This checks:
- All 7 forms have autosave imports
- Draft recovery alerts are present
- clearDraft() called on success
- Hooks configured correctly

---

## 📋 Manual Testing Checklist

### Test Environment Setup

**Prerequisites:**
1. ✅ Backend running: `cd apps/backend && uvicorn src.api.main:app --reload`
2. ✅ Frontend running: `cd apps/web && pnpm dev`
3. ✅ Logged in as user
4. ✅ Clear localStorage: Open DevTools → Application → Local Storage → Clear All

**Browser DevTools Setup:**
1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. Expand **Local Storage** → `http://localhost:3000`
4. Keep this visible during testing to watch drafts save

---

## 🧪 Test Scenarios

### Scenario 1: Basic Autosave (CRITICAL)

**Test Form:** OrderForm (dialog-based)

**Steps:**
1. Navigate to **Orders** page
2. Click **"Create Order"** button
3. Open DevTools → Application → Local Storage
4. Select a customer from dropdown
5. Add 2 line items with products and quantities
6. Add notes: "Test order for autosave"
7. **Wait 3 seconds** (for debounce)

**Expected Results:**
- ✅ In localStorage, see key: `draft_order-form-new`
- ✅ Value contains: customer_id, lineItems array, notes
- ✅ Timestamp: `savedAt` is recent
- ✅ Expiry: `expiresAt` is ~7 days from now

**Screenshot:**
```
draft_order-form-new: {
  "data": {
    "customer_id": "...",
    "lineItems": [...],
    "notes": "Test order for autosave"
  },
  "metadata": {
    "savedAt": "2026-02-03T...",
    "expiresAt": "2026-02-10T...",
    "version": 1
  }
}
```

---

### Scenario 2: Draft Recovery (CRITICAL)

**Test Form:** CustomerForm

**Steps:**
1. Navigate to **Customers** page
2. Click **"Create Customer"**
3. Fill in:
   - Customer Number: `CUST-TEST-001`
   - Company Name: `Acme Test Corp`
   - Email: `test@acme.com`
   - Phone: `555-1234`
4. Wait 3 seconds
5. **Close dialog WITHOUT saving** (click X or press Esc)
6. **Reopen** "Create Customer" dialog

**Expected Results:**
- ✅ Blue banner appears: **"Draft Available"**
- ✅ Shows: "You have unsaved work from X seconds ago"
- ✅ Two buttons: **"Restore Draft"** and **"Discard"**

**Then click "Restore Draft":**
- ✅ All fields populate with saved data
- ✅ Customer Number: `CUST-TEST-001`
- ✅ Company Name: `Acme Test Corp`
- ✅ Email and Phone: restored

---

### Scenario 3: Draft Discard

**Continuing from Scenario 2:**

**Steps:**
1. Form should have restored data
2. Close dialog again
3. Reopen dialog → Draft alert appears
4. Click **"Discard"** button

**Expected Results:**
- ✅ Draft alert disappears immediately
- ✅ Form is blank/empty
- ✅ In localStorage: `draft_customer-form-new` is DELETED
- ✅ Reopen dialog again → NO draft alert (draft gone)

---

### Scenario 4: Auto-Clear on Submit (CRITICAL)

**Test Form:** ProductForm

**Steps:**
1. Navigate to **Products** page
2. Click **"Create Product"**
3. Fill in:
   - SKU: `PROD-TEST-001`
   - Name: `Test Widget`
   - Category: Power Tools
   - Price: `99.99`
   - Stock: `50`
4. Wait 3 seconds (draft saves)
5. Check localStorage: `draft_product-form-new` exists
6. Click **"Create"** to submit

**Expected Results:**
- ✅ Product created successfully
- ✅ Success toast appears
- ✅ Dialog closes
- ✅ **In localStorage: `draft_product-form-new` is DELETED**
- ✅ Reopen form → NO draft alert (auto-cleared)

---

### Scenario 5: Edit Mode (No Autosave)

**Test Form:** Any form in edit mode

**Steps:**
1. Navigate to **Products** page
2. Click **Edit** on existing product
3. Change name to "Modified Product"
4. Wait 5 seconds
5. Check localStorage

**Expected Results:**
- ✅ NO draft is saved for edit mode
- ✅ No `draft_product-form-{id}` in localStorage
- ✅ Autosave is disabled for edits (by design)

**Rationale:** We only autosave NEW items to avoid conflicts/confusion

---

### Scenario 6: Browser Refresh Persistence

**Test Form:** QuoteForm

**Steps:**
1. Navigate to **Quotes** page
2. Click **"Create Quote"**
3. Fill in:
   - Customer: Select any
   - Add 3 quote items
   - Notes: "Multi-line items test"
4. Wait 3 seconds (draft saves)
5. **Refresh browser (F5)** or close/reopen tab
6. Navigate back to Quotes page
7. Click **"Create Quote"**

**Expected Results:**
- ✅ Draft alert appears immediately
- ✅ Click "Restore Draft"
- ✅ All 3 line items restored correctly
- ✅ Customer selection restored
- ✅ Notes restored

---

### Scenario 7: Multiple Drafts (Different Forms)

**Test:** Ensure drafts don't interfere with each other

**Steps:**
1. Create draft in **OrderForm** (add customer + items)
2. Close without saving
3. Create draft in **QuoteForm** (add different customer + items)
4. Close without saving
5. Check localStorage

**Expected Results:**
- ✅ Two separate keys exist:
  - `draft_order-form-new`
  - `draft_quote-form-new`
- ✅ Each contains correct data (no mixing)
- ✅ Restore order draft → Only order data appears
- ✅ Restore quote draft → Only quote data appears

---

### Scenario 8: Line Items Restoration (Complex Forms)

**Test Form:** PurchaseOrderForm

**Steps:**
1. Navigate to **Purchase Orders** page
2. Click **"Create Purchase Order"**
3. Fill in:
   - Supplier: Select any
   - Delivery Location: Sydney
   - Expected Delivery: Future date
4. Add 4 line items with:
   - Different products
   - Different quantities (1, 5, 10, 20)
   - Different unit costs
5. Wait 3 seconds
6. Close dialog
7. Reopen and restore draft

**Expected Results:**
- ✅ All 4 line items restored
- ✅ Quantities correct: 1, 5, 10, 20
- ✅ Products selected correctly
- ✅ Unit costs preserved
- ✅ Calculated totals match

---

### Scenario 9: Expired Draft Cleanup

**Test:** Simulate expired draft (7+ days old)

**Manual Test (Quick Version):**
1. Create draft in SupplierForm
2. Open DevTools → Console
3. Run:
```javascript
// Get the draft
const draft = JSON.parse(localStorage.getItem('draft_supplier-form-new'));

// Set expiry to yesterday
draft.metadata.expiresAt = new Date(Date.now() - 86400000).toISOString();

// Save it back
localStorage.setItem('draft_supplier-form-new', JSON.stringify(draft));
```
4. Reopen SupplierForm

**Expected Results:**
- ✅ NO draft alert appears (expired draft ignored)
- ✅ Draft is auto-deleted from localStorage
- ✅ Form starts fresh

---

### Scenario 10: localStorage Quota Handling

**Test:** What happens when storage is full

**Steps:**
1. Open DevTools → Console
2. Fill localStorage with dummy data:
```javascript
// Fill localStorage to near-capacity
for (let i = 0; i < 100; i++) {
  try {
    localStorage.setItem(`dummy_${i}`, 'x'.repeat(50000));
  } catch (e) {
    console.log('Storage full at', i);
    break;
  }
}
```
3. Try to create draft in OrderForm
4. Fill form and wait for autosave

**Expected Results:**
- ✅ Autosave detects quota exceeded
- ✅ Calls `clearExpired()` to clean old drafts
- ✅ Retries save after cleanup
- ✅ Draft saves successfully OR gracefully fails
- ✅ No console errors crash the app

**Cleanup:**
```javascript
// Clear dummy data
for (let i = 0; i < 100; i++) {
  localStorage.removeItem(`dummy_${i}`);
}
```

---

## 🎨 Form-Specific Tests

### OrderForm (Dialog + Line Items)
- ✅ Customer selection saved
- ✅ Multiple line items saved
- ✅ Quantities and prices preserved
- ✅ Status selection saved
- ✅ Notes field saved

### QuoteForm (Dialog + Line Items)
- ✅ Customer selection saved
- ✅ Quote items with products saved
- ✅ Valid until date saved
- ✅ Status saved
- ✅ Notes saved

### CustomerForm (Dialog + Simple Fields)
- ✅ All 10+ fields saved
- ✅ Company name, email, phone saved
- ✅ Address fields saved
- ✅ Active toggle saved

### ProductForm (Dialog + Simple Fields)
- ✅ SKU saved
- ✅ Name, description saved
- ✅ Category dropdown saved
- ✅ Price and cost saved (numbers)
- ✅ Stock quantity saved
- ✅ Warehouse location saved

### PurchaseOrderForm (Dialog + Line Items)
- ✅ Supplier selection saved
- ✅ Delivery location saved
- ✅ Expected delivery date saved
- ✅ PO line items saved
- ✅ Shipping cost saved

### SupplierForm (Embedded Form)
- ✅ Supplier code saved
- ✅ Company details saved
- ✅ Contact info saved
- ✅ Payment terms saved
- ✅ ABN saved

### OutboundShipmentForm (Embedded Form)
- ✅ Order ID saved
- ✅ Carrier details saved
- ✅ Tracking number saved
- ✅ Origin/destination saved
- ✅ Dates saved

---

## 🐛 Known Edge Cases to Test

### Edge Case 1: Rapid Form Open/Close
**Steps:**
1. Open OrderForm
2. Add data
3. Close immediately (before 2-second debounce)
4. Reopen

**Expected:** No draft (didn't wait for debounce)

### Edge Case 2: Switching Between Create Forms
**Steps:**
1. Start OrderForm, add data
2. Close
3. Open QuoteForm, add data
4. Close
5. Reopen OrderForm

**Expected:** Order draft appears (not quote draft)

### Edge Case 3: Empty Line Items Array
**Steps:**
1. Open OrderForm
2. Select customer but add NO line items
3. Wait 3 seconds
4. Close and reopen

**Expected:**
- Draft saves with empty lineItems
- Restore shows customer but no items

### Edge Case 4: Special Characters in Fields
**Steps:**
1. Open CustomerForm
2. Enter:
   - Name: `Test & Co. "Special" Chars <>`
   - Notes: Multi-line with \n newlines
3. Save draft and restore

**Expected:**
- Special chars preserved
- Newlines preserved
- No JSON parsing errors

---

## 📊 Test Results Template

Copy this to track your testing:

```markdown
## Autosave Testing Results - [Date]

### ✅ Passing Tests
- [ ] Scenario 1: Basic Autosave
- [ ] Scenario 2: Draft Recovery
- [ ] Scenario 3: Draft Discard
- [ ] Scenario 4: Auto-Clear on Submit
- [ ] Scenario 5: Edit Mode (No Autosave)
- [ ] Scenario 6: Browser Refresh Persistence
- [ ] Scenario 7: Multiple Drafts
- [ ] Scenario 8: Line Items Restoration
- [ ] Scenario 9: Expired Draft Cleanup
- [ ] Scenario 10: localStorage Quota

### ❌ Failing Tests
(List any failures here with details)

### 🐛 Bugs Found
(List any issues discovered)

### 📈 Performance Notes
- Autosave debounce feels: [ ] Smooth [ ] Laggy
- Draft restore speed: [ ] Instant [ ] Slow
- localStorage size after testing: ____ KB

### 💡 Improvement Ideas
(Any UX improvements noticed during testing)
```

---

## 🚨 Critical Issues to Watch For

1. **Data Loss:**
   - Draft doesn't save → Check debounce timing
   - Draft doesn't restore → Check key names match

2. **Performance:**
   - Form typing feels laggy → Increase debounce from 2s to 3s
   - Large forms slow → Consider compression

3. **Storage:**
   - localStorage errors → Implement cleanup
   - Quota exceeded → Check clearExpired() works

4. **UI/UX:**
   - Draft alert not visible → Check z-index
   - Restore button doesn't work → Check onRestore callback

---

## 🔧 Debugging Tips

### View All Drafts in Console
```javascript
// List all draft keys
Object.keys(localStorage).filter(k => k.startsWith('draft_'))

// View specific draft
JSON.parse(localStorage.getItem('draft_order-form-new'))

// Clear all drafts
Object.keys(localStorage)
  .filter(k => k.startsWith('draft_'))
  .forEach(k => localStorage.removeItem(k))
```

### Force Draft Creation
```javascript
// Manually create a test draft
const testDraft = {
  data: { customer_id: "test-123", notes: "Manual test" },
  metadata: {
    key: "order-form-new",
    savedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
    version: 1
  }
};
localStorage.setItem('draft_order-form-new', JSON.stringify(testDraft));
```

### Watch Autosave in Action
```javascript
// In DevTools Console, monitor localStorage changes
const original = localStorage.setItem;
localStorage.setItem = function(key, value) {
  if (key.startsWith('draft_')) {
    console.log('[DRAFT SAVED]', key, JSON.parse(value));
  }
  original.apply(this, arguments);
};
```

---

## ✅ Success Criteria

**Autosave system is considered PASSING if:**

1. ✅ All 7 forms save drafts within 2 seconds
2. ✅ Draft recovery alert appears on all forms
3. ✅ Restore button populates all fields correctly
4. ✅ Discard button clears drafts permanently
5. ✅ Submit auto-clears drafts on success
6. ✅ Edit mode does NOT save drafts
7. ✅ Browser refresh preserves drafts
8. ✅ Multiple forms maintain separate drafts
9. ✅ Line items restore correctly (complex forms)
10. ✅ No console errors during any test

**If any test fails:**
1. Document the issue
2. Check validation script output
3. Review implementation in failing form
4. Compare to working form (OrderForm/QuoteForm)
5. Report findings

---

## 📞 Support

**If tests fail consistently:**
- Check browser console for errors
- Verify localStorage is enabled (not in incognito)
- Ensure forms are in "create" mode (not "edit")
- Check debounce timing (might need to wait longer)

**Next Steps After Testing:**
- Document any bugs found
- Fix critical issues
- Move to Task #19 (Recent Items Cache)

---

**Happy Testing! 🎉**
