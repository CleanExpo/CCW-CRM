/**
 * UNI-2706: on a phone, each row card must not repeat the header's select-all
 * checkbox. The select column's `label` is the select-all control, so rendering
 * it inside every card put a "select every row" checkbox next to each row's own
 * checkbox, one tap away from a bulk delete.
 *
 * ResponsiveTable switches layout with CSS only (`hidden md:block` for the
 * table, `md:hidden` for the cards), so jsdom renders both. Each assertion is
 * scoped to one of those two containers.
 */
import { describe, it, expect } from 'vitest';
import { render, within } from '@testing-library/react';
import { ResponsiveTable } from '../ResponsiveTable';

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Bravo' },
];

function renderTable(selectColumnExtras: { mobileLabel?: string } = {}) {
  return render(
    <ResponsiveTable
      data={rows}
      keyExtractor={(row) => row.id}
      columns={[
        {
          key: 'select',
          label: <input type="checkbox" aria-label="Select all rows" />,
          render: (row) => <input type="checkbox" aria-label={`Select ${row.name}`} />,
          ...selectColumnExtras,
        },
        { key: 'name', label: 'Name', render: (row) => row.name },
      ]}
    />
  );
}

function mobileCards(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('.md\\:hidden');
  if (!el) throw new Error('mobile card container not found');
  return el;
}

function desktopTable(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('.hidden.md\\:block');
  if (!el) throw new Error('desktop table container not found');
  return el;
}

describe('ResponsiveTable mobile cards (UNI-2706)', () => {
  it("renders each row's own checkbox but never the select-all control", () => {
    const { container } = renderTable();
    const mobile = within(mobileCards(container));

    expect(mobile.getByRole('checkbox', { name: 'Select Alpha' })).toBeInTheDocument();
    expect(mobile.getByRole('checkbox', { name: 'Select Bravo' })).toBeInTheDocument();
    expect(mobile.queryAllByRole('checkbox', { name: 'Select all rows' })).toHaveLength(0);
    expect(mobile.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('still shows string labels on mobile cards', () => {
    const { container } = renderTable();
    expect(within(mobileCards(container)).getAllByText('Name')).toHaveLength(2);
  });

  it('shows mobileLabel in place of a non-string label', () => {
    const { container } = renderTable({ mobileLabel: 'Select' });
    const mobile = within(mobileCards(container));
    expect(mobile.getAllByText('Select')).toHaveLength(2);
    expect(mobile.queryAllByRole('checkbox', { name: 'Select all rows' })).toHaveLength(0);
  });
});

describe('ResponsiveTable desktop header', () => {
  it('keeps the select-all control in the header, once', () => {
    const { container } = renderTable();
    const desktop = within(desktopTable(container));
    expect(desktop.getAllByRole('checkbox', { name: 'Select all rows' })).toHaveLength(1);
    expect(desktop.getByRole('checkbox', { name: 'Select Alpha' })).toBeInTheDocument();
  });
});
