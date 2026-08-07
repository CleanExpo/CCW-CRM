import { cin7FieldHealCompare } from '@/lib/integrations/cin7-field-heal';
import { describe, expect, it } from 'vitest';

const { customerFieldsMatch, internalCustomerFieldsMatch, supplierFieldsMatch, branchFieldsMatch } =
  cin7FieldHealCompare;

describe('cin7FieldHealCompare', () => {
  it('matches customers on name/email/phone/city (case-insensitive)', () => {
    expect(
      customerFieldsMatch(
        {
          companyName: ' Acme ',
          email: 'a@x.com',
          phone: '111',
          city: 'Brisbane',
        },
        {
          cin7ContactId: '1',
          contactType: 'Customer',
          companyName: 'acme',
          email: 'A@X.COM',
          phone: '111',
          city: 'brisbane',
        }
      )
    ).toBe(true);
  });

  it('fails customer match when city differs', () => {
    expect(
      customerFieldsMatch(
        { companyName: 'Acme', email: 'a@x.com', phone: null, city: 'Sydney' },
        {
          cin7ContactId: '1',
          contactType: 'Customer',
          companyName: 'Acme',
          email: 'a@x.com',
          city: 'Brisbane',
        }
      )
    ).toBe(false);
  });

  it('matches internal customers on name + email only', () => {
    expect(
      internalCustomerFieldsMatch(
        { companyName: 'Staff', email: 's@x.com' },
        {
          cin7ContactId: '2',
          contactType: 'Internal',
          companyName: 'staff',
          email: 's@x.com',
          phone: 'different-ignored',
          city: 'ignored',
        }
      )
    ).toBe(true);
  });

  it('matches suppliers on name/email/phone', () => {
    expect(
      supplierFieldsMatch(
        { companyName: 'Supp', email: 's@y.com', phone: '9' },
        {
          cin7ContactId: '3',
          contactType: 'Supplier',
          companyName: 'Supp',
          email: 's@y.com',
          phone: '9',
        }
      )
    ).toBe(true);
  });

  it('matches branches including isActive', () => {
    expect(
      branchFieldsMatch(
        {
          name: 'Main',
          city: 'BNE',
          state: 'QLD',
          postCode: '4000',
          isActive: true,
        },
        {
          cin7BranchId: 'b1',
          name: 'main',
          city: 'bne',
          state: 'qld',
          postCode: '4000',
          isActive: true,
        }
      )
    ).toBe(true);
    expect(
      branchFieldsMatch(
        {
          name: 'Main',
          city: 'BNE',
          state: 'QLD',
          postCode: '4000',
          isActive: true,
        },
        {
          cin7BranchId: 'b1',
          name: 'Main',
          city: 'BNE',
          state: 'QLD',
          postCode: '4000',
          isActive: false,
        }
      )
    ).toBe(false);
  });
});
