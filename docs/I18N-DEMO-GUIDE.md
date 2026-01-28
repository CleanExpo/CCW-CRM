# i18n Demo - Quick Start Guide

## Demo Page Created! 🎉

A comprehensive i18n demonstration page is now live at: **`/demo/i18n`**

---

## What's Been Built

### 1. LanguageSwitcher Component (Dropdown)
**Location**: `components/layout/LanguageSwitcher.tsx`

**Features**:
- Dropdown menu with all 10 languages
- Flag emojis for visual identification
- Native language names
- Checkmark on current language
- Cookie-based persistence
- Smooth refresh on language change

**Usage**:
```tsx
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

// Dropdown variant (recommended)
<LanguageSwitcher currentLocale={locale} variant="dropdown" />

// Select variant (alternative)
<LanguageSwitcher currentLocale={locale} variant="select" />
```

---

### 2. Demo Page Features

**URL**: `http://localhost:3000/demo/i18n`

**Showcases**:
- ✅ Language switcher dropdown in top-right
- ✅ Current language display with flag
- ✅ RTL indicator (for Arabic)
- ✅ Common UI buttons (Save, Cancel, Delete, Edit, Create)
- ✅ Navigation menu translations
- ✅ Product categories (industry-specific)
- ✅ Order statuses with icons
- ✅ Dashboard metrics
- ✅ Error messages
- ✅ All text updates instantly when switching languages

---

## How to Test

### Step 1: Start the Application

```bash
# Terminal 1: Start backend (optional for full demo)
cd apps/backend
uv run uvicorn src.api.main:app --reload

# Terminal 2: Start frontend
cd apps/web
pnpm install  # First time only
pnpm dev
```

### Step 2: Access Demo Page

Navigate to: **`http://localhost:3000/demo/i18n`**

### Step 3: Test Language Switching

1. **Click the language dropdown** (top-right corner with globe icon)
2. **Select a language** from the menu:
   - 🇬🇧 English (default)
   - 🇨🇳 简体中文 (Chinese Simplified) - Full translation
   - 🇪🇸 Español (Spanish) - Full translation
   - 🇹🇼 繁體中文 (Chinese Traditional) - Template
   - 🇵🇹 Português (Portuguese) - Template
   - 🇸🇦 العربية (Arabic) - Template, RTL supported
   - 🇻🇳 Tiếng Việt (Vietnamese) - Template
   - 🇮🇳 हिन्दी (Hindi) - Template
   - 🇮🇳 தமிழ் (Tamil) - Template
   - 🇮🇳 తెలుగు (Telugu) - Template

3. **Page refreshes** and all text updates to selected language
4. **Cookie is set** - preference persists across page reloads

---

## Translation Quality

| Language | Status | Quality |
|----------|--------|---------|
| English | ✅ Complete | Reference (100%) |
| Chinese (Simplified) | ✅ Complete | Professional (100%) |
| Spanish | ✅ Complete | Professional (100%) |
| Chinese (Traditional) | ⚠️ Template | English fallback |
| Portuguese | ⚠️ Template | English fallback |
| Arabic | ⚠️ Template | English fallback, RTL ready |
| Vietnamese | ⚠️ Template | English fallback |
| Hindi | ⚠️ Template | English fallback |
| Tamil | ⚠️ Template | English fallback |
| Telugu | ⚠️ Template | English fallback |

**Note**: Template languages currently show English text. These can be:
- Manually translated by native speakers
- AI-translated using the I18nService backend
- Professionally translated via translation management dashboard

---

## Technical Implementation

### Cookie-Based Locale Detection

The system uses cookies instead of URL-based routing (`/en/`, `/es/`, etc.) for:
- ✅ Simpler implementation
- ✅ No route changes needed
- ✅ Works with existing auth middleware
- ✅ Persistent across sessions

**Cookie**: `NEXT_LOCALE=es` (max-age: 1 year)

### Translation Hook

```tsx
import { useTranslations } from "next-intl";

export function MyComponent() {
  const t = useTranslations();

  return (
    <div>
      <h1>{t("dashboard.title")}</h1>
      <p>{t("dashboard.welcome")}</p>
      <Button>{t("common.save")}</Button>
    </div>
  );
}
```

### Server Component Translation

```tsx
import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations();

  return <h1>{t("dashboard.title")}</h1>;
}
```

---

## What's Demonstrated

### 1. Common Translations (`common` namespace)
- UI buttons: Save, Cancel, Delete, Edit, Create
- Actions: Search, Filter, Refresh, Export, Import
- Labels: Name, Description, Status, Date, Total, Quantity

### 2. Navigation (`navigation` namespace)
- Dashboard, Products, Customers, Orders, Quotes
- Inventory, Reports, Settings, Help, Profile

### 3. Product Categories (`products.categories`)
- Heavy Machinery
- Hand Tools
- Power Tools
- Safety Equipment
- Building Materials
- Electrical
- Plumbing
- Accessories

### 4. Order Statuses (`orders.statuses`)
- Draft, Pending, Confirmed
- Processing, Shipped, Delivered, Cancelled

### 5. Dashboard Metrics
- Orders count
- Customers count
- Revenue
- Sales

### 6. Error Messages (`errors` namespace)
- Required field
- Invalid email
- Network error

---

## Component Variants

### Dropdown (Recommended)
```tsx
<LanguageSwitcher currentLocale={locale} variant="dropdown" />
```
- Compact button with globe icon
- Shows flag and language name
- Clean dropdown menu

### Select (Alternative)
```tsx
<LanguageSwitcher currentLocale={locale} variant="select" />
```
- Traditional select dropdown
- Shows flag and native name
- Good for settings pages

---

## Next Steps

### Complete Remaining Languages
1. Use AI translation service to generate translations
2. Human review for accuracy
3. Update template files with proper translations

### Add to Existing Pages
```tsx
// In any page component
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { cookies } from "next/headers";

async function getLocale() {
  const cookieStore = await cookies();
  return cookieStore.get("NEXT_LOCALE")?.value || "en";
}

export default async function Page() {
  const locale = await getLocale();

  return (
    <div>
      <LanguageSwitcher currentLocale={locale} variant="dropdown" />
      {/* Your page content with translations */}
    </div>
  );
}
```

### Translation Management Dashboard
Build admin UI to:
- View translation status
- Bulk translate products
- Review AI translations
- Approve/edit translations

---

## Troubleshooting

### Language doesn't change
1. Check browser console for errors
2. Verify cookie is set: `document.cookie` in browser console
3. Hard refresh: `Ctrl+Shift+R` or `Cmd+Shift+R`

### Translations show English
1. Check language file exists: `i18n/messages/{locale}.json`
2. Verify translation key exists in file
3. Check browser console for import errors

### RTL not working
Arabic support requires additional CSS:
```css
[dir="rtl"] {
  direction: rtl;
  text-align: right;
}
```

---

## Files Reference

**Configuration**:
- `i18n/config.ts` - Language definitions
- `i18n/request.ts` - Server component config

**Translation Files**:
- `i18n/messages/en.json` - English (reference)
- `i18n/messages/zh-CN.json` - Chinese Simplified
- `i18n/messages/es.json` - Spanish
- `i18n/messages/*.json` - Other languages

**Components**:
- `components/layout/LanguageSwitcher.tsx` - Language selector
- `components/providers/i18n-provider.tsx` - Client provider

**Demo**:
- `app/demo/i18n/page.tsx` - Full demo page

**Backend**:
- `apps/backend/src/services/i18n_service.py` - AI translation
- `apps/backend/src/db/i18n_models.py` - Database models
- `apps/backend/migrations/add_i18n_support.sql` - Schema

---

## Support

For questions or issues:
1. Check `docs/IMPLEMENTATION-PROGRESS.md` for full status
2. Review translation files in `i18n/messages/`
3. Test backend translation service
4. Check browser console for errors

---

## Translation Management Dashboard

### Accessing the Dashboard

Navigate to: **`http://localhost:3000/settings/translations`**

Or use the sidebar navigation: **Translations** (globe icon)

### Dashboard Features

#### 1. Coverage Overview Tab
- **Visual Statistics**: Progress bars showing translation coverage for each language
- **Status Breakdown**:
  - Pending translations (not yet translated)
  - AI Generated (awaiting review)
  - Human Reviewed (verified by humans)
  - Approved (production-ready)
- **Coverage Percentage**: Real-time calculation of translated vs. total products

#### 2. Product Translations Tab
- **Product List**: View all products with their translation status across languages
- **Search & Filter**:
  - Search by product name or SKU
  - Filter by target language
  - Filter by translation status
- **Quick Actions**: Edit translations for any product
- **Pagination**: Navigate through large product catalogs

#### 3. Review Queue Tab
- **AI-Generated Translations**: List of translations awaiting human review
- **Quick Review**: Rapidly review and approve AI-generated content
- **Status Updates**: Mark translations as reviewed or approved

### Using the Dashboard

#### Bulk Translation
1. Click **"Bulk Translate"** button in the top right
2. (Optional) Enter product filter to limit which products to translate
3. Select target languages (checkboxes)
4. Click **"Queue Translations"**
5. Translations will be generated in the background and appear in the Review Queue

#### AI Translation Generation (Single Product)
1. Navigate to Product Translations tab
2. Click **Edit** (pencil icon) on any product row
3. Select target language from dropdown
4. Click **"AI Generate"** button
5. Review the generated translation
6. Edit if needed
7. Set status (e.g., "Human Reviewed") and click **"Save Translation"**

#### Manual Translation Editing
1. Click **Edit** on any product
2. Select language
3. Fill in all fields:
   - **Content Tab**: Product name, short description, full description
   - **SEO Tab**: Meta title (max 60 chars), meta description (max 160 chars)
4. Choose translation status
5. Click **"Save Translation"**

### Translation Status Workflow

```
1. pending → No translation exists yet
2. ai_generated → AI has generated translation, needs review
3. human_reviewed → Human has verified translation accuracy
4. approved → Production-ready, approved for use
```

### Best Practices

1. **Review AI Translations**: Always review AI-generated content for:
   - Technical terminology accuracy
   - Cultural appropriateness
   - Brand voice consistency

2. **SEO Optimization**: Fill in meta_title and meta_description for better search engine visibility

3. **Batch Processing**: Use bulk translate for efficiency, then review in batches

4. **Status Management**:
   - Mark as "human_reviewed" after verifying
   - Only mark as "approved" when fully confident

---

**Status**: Phase 1 i18n - ✅ COMPLETE (9/9 tasks)
**Last Updated**: 2026-01-20
