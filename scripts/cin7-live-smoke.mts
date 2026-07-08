import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: true });

const { getCin7OmniCredentials } = await import('../src/lib/integrations/cin7-omni.ts');
const { fetchAllOmniMasterCatalogsSequential } = await import(
  '../src/lib/integrations/cin7-catalog-fetch.ts'
);

const omni = getCin7OmniCredentials();
if (!omni) process.exit(1);

const catalogs = await fetchAllOmniMasterCatalogsSequential(omni);
const targets = { products: 9823, customers: 22640, suppliers: 553, branches: 10 };

console.log(
  JSON.stringify(
    {
      products: catalogs.products.skus.length,
      customers: catalogs.customers.contacts.length,
      suppliers: catalogs.suppliers.contacts.length,
      internal: catalogs.internalCustomers.contacts.length,
      branches: catalogs.branches.branches.length,
      pages: {
        products: catalogs.products.pages_fetched,
        customers: catalogs.customers.pages_fetched,
        suppliers: catalogs.suppliers.pages_fetched,
        branches: catalogs.branches.pages_fetched,
      },
      targets,
      match: {
        products: Math.abs(catalogs.products.skus.length - targets.products) <= 50,
        customers: Math.abs(catalogs.customers.contacts.length - targets.customers) <= 200,
        suppliers: Math.abs(catalogs.suppliers.contacts.length - targets.suppliers) <= 100,
        branches: Math.abs(catalogs.branches.branches.length - targets.branches) <= 5,
      },
      errors: {
        customers: catalogs.customers.errors.slice(-5),
        suppliers: catalogs.suppliers.errors,
      },
    },
    null,
    2
  )
);
