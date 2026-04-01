#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const pages = [
  'customers/page.tsx',
  'orders/page.tsx',
  'quotes/page.tsx',
  'invoices/page.tsx',
  'inventory/page.tsx',
  'warehouse/page.tsx',
  'purchase-orders/page.tsx',
  'approvals/page.tsx',
  'tasks/page.tsx',
  'contractors/page.tsx',
  'service-requests/page.tsx',
  'bank-feeds/page.tsx',
  'reconciliation/page.tsx',
  'pos/page.tsx',
  'settings/integrations/page.tsx',
  'settings/integrations/cin7/page.tsx',
  'settings/integrations/xero/page.tsx',
  'settings/integrations/shopify/page.tsx',
  'settings/integrations/ap2/page.tsx',
  'settings/billing/page.tsx',
  'settings/users/page.tsx',
  'settings/organization/page.tsx',
  'workflows/page.tsx',
  'alerts/page.tsx',
  'reports/page.tsx',
  'marketing/page.tsx',
  'faq/page.tsx',
  'customers/health/page.tsx',
  'customers/onboarding/page.tsx',
  'customers/personas/page.tsx',
  'workshop/page.tsx',
  'workshop/equipment/page.tsx',
  'workshop/schedule/page.tsx',
  'workshop/templates/page.tsx',
];

const baseDir = path.join(__dirname, '..', 'apps', 'web', 'app', '(dashboard)');

function wrapPage(filePath) {
  const fullPath = path.join(baseDir, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${filePath} - file not found`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');

  // Check if already wrapped
  if (content.includes('@/components/errors/ErrorBoundary')) {
    console.log(`✅ Skipping ${filePath} - already wrapped`);
    return false;
  }

  // Add import if not present
  if (!content.includes('import { ErrorBoundary }')) {
    // Find last import line
    const lines = content.split('\n');
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex >= 0) {
      lines.splice(
        lastImportIndex + 1,
        0,
        "import { ErrorBoundary } from '@/components/errors/ErrorBoundary';"
      );
      content = lines.join('\n');
    }
  }

  // Find the main return statement
  const returnMatch = content.match(/(\n  return \(\n    <)(div|ErrorBoundary|>\s*<div)/);

  if (!returnMatch) {
    console.log(`⚠️  Could not find return statement in ${filePath}`);
    return false;
  }

  // Wrap the content after return (
  const returnIndex = content.indexOf(returnMatch[0]);

  // Find the matching closing tags before final );
  // We need to find the last </div> before the final );
  const closingPattern = /\n    <\/div>\n  \);\n}(?:\n|$)/;
  const closingMatch = content.match(closingPattern);

  if (!closingMatch) {
    console.log(`⚠️  Could not find closing tags in ${filePath}`);
    return false;
  }

  // Replace opening
  content = content.replace(
    /\n  return \(\n    <div/,
    '\n  return (\n    <ErrorBoundary>\n      <div'
  );

  // Replace closing
  content = content.replace(
    /\n    <\/div>\n  \);\n}/,
    '\n      </div>\n    </ErrorBoundary>\n  );\n}'
  );

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`✅ Wrapped ${filePath}`);
  return true;
}

let wrapped = 0;
let skipped = 0;
let errors = 0;

for (const page of pages) {
  try {
    const result = wrapPage(page);
    if (result) {
      wrapped++;
    } else {
      skipped++;
    }
  } catch (error) {
    console.error(`❌ Error processing ${page}:`, error.message);
    errors++;
  }
}

console.log(`\n📊 Summary:`);
console.log(`   ✅ Wrapped: ${wrapped}`);
console.log(`   ⏭️  Skipped: ${skipped}`);
console.log(`   ❌ Errors: ${errors}`);
