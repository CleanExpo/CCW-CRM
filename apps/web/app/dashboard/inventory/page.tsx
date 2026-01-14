'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface StockItem {
    sku: string;
    name: string;
    category: string;
    brand: string;
    stock: {
        Boondall: number;
        SevenHills: number;
        Bayswater: number;
    };
    price: number;
}

const MOCK_INVENTORY: StockItem[] = [
    { sku: 'TM-PRO-500', name: 'Truckmount Pro 500', category: 'Truckmounts', brand: 'Sapphire', stock: { Boondall: 3, SevenHills: 5, Bayswater: 2 }, price: 18500 },
    { sku: 'RB-COMPACT-200', name: 'Razorback Compact 200', category: 'Portables', brand: 'Razorback', stock: { Boondall: 8, SevenHills: 12, Bayswater: 6 }, price: 2200 },
    { sku: 'AM-PHOENIX-3', name: 'Phoenix Air Mover 3-Speed', category: 'AirMovers', brand: 'Phoenix', stock: { Boondall: 24, SevenHills: 18, Bayswater: 15 }, price: 450 },
    { sku: 'DH-DRIEAZ-1200', name: 'Dri-Eaz LGR 1200', category: 'Dehumidifiers', brand: 'Dri-Eaz', stock: { Boondall: 4, SevenHills: 3, Bayswater: 2 }, price: 1800 },
    { sku: 'CH-PROCHEM-5L', name: 'ProChem Traffic Lane 5L', category: 'Chemicals', brand: 'ProChem', stock: { Boondall: 45, SevenHills: 38, Bayswater: 42 }, price: 85 },
    { sku: 'TM-ULTRA-700', name: 'Truckmount Ultra 700', category: 'Truckmounts', brand: 'Sapphire', stock: { Boondall: 1, SevenHills: 2, Bayswater: 0 }, price: 24500 },
];

type Branch = 'Boondall' | 'SevenHills' | 'Bayswater';

export default function InventoryPage() {
    const [inventory, setInventory] = useState<StockItem[]>(MOCK_INVENTORY);
    const [filter, setFilter] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [selectedBranch, setSelectedBranch] = useState<Branch | 'all'>('all');

    const categories = ['all', ...new Set(inventory.map((i) => i.category))];

    const filteredInventory = inventory.filter((item) => {
        const matchesCategory = filter === 'all' || item.category === filter;
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.sku.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const getTotalStock = (item: StockItem) =>
        item.stock.Boondall + item.stock.SevenHills + item.stock.Bayswater;

    const isLowStock = (item: StockItem, branch?: Branch) => {
        if (branch) return item.stock[branch] < 5;
        return getTotalStock(item) < 10;
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-ccw-navy shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-white">CCW Digital Operations Hub</h1>
                        <span className="px-2 py-0.5 bg-ccw-gold text-ccw-navy text-xs font-bold rounded">BETA</span>
                    </div>
                    <nav className="flex gap-4">
                        <Link href="/dashboard" className="text-white/70 hover:text-white">Dashboard</Link>
                        <Link href="/dashboard/agents" className="text-white/70 hover:text-white">Agents</Link>
                        <Link href="/dashboard/inventory" className="text-white font-medium">Inventory</Link>
                    </nav>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
                    <div className="flex gap-2">
                        {(['all', 'Boondall', 'SevenHills', 'Bayswater'] as const).map((branch) => (
                            <button
                                key={branch}
                                onClick={() => setSelectedBranch(branch)}
                                className={`px-3 py-1 rounded text-sm font-medium ${selectedBranch === branch
                                        ? 'bg-ccw-gold text-ccw-navy'
                                        : 'bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                {branch === 'all' ? 'All Branches' : branch === 'SevenHills' ? 'Seven Hills' : branch}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex gap-4">
                    <input
                        type="text"
                        placeholder="Search SKU or product name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                        {categories.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat === 'all' ? 'All Categories' : cat}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Inventory Table */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-ccw-navy text-white text-sm">
                            <tr>
                                <th className="px-4 py-3 text-left">SKU</th>
                                <th className="px-4 py-3 text-left">Product</th>
                                <th className="px-4 py-3 text-left">Category</th>
                                <th className="px-4 py-3 text-right">Price</th>
                                <th className="px-4 py-3 text-center">Boondall</th>
                                <th className="px-4 py-3 text-center">Seven Hills</th>
                                <th className="px-4 py-3 text-center">Bayswater</th>
                                <th className="px-4 py-3 text-center">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInventory.map((item) => (
                                <tr key={item.sku} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="px-4 py-3 font-mono text-sm">{item.sku}</td>
                                    <td className="px-4 py-3">
                                        <div>{item.name}</div>
                                        <div className="text-xs text-gray-500">{item.brand}</div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{item.category}</td>
                                    <td className="px-4 py-3 text-right font-medium">
                                        ${item.price.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded text-sm ${isLowStock(item, 'Boondall') ? 'bg-red-100 text-red-700' : ''
                                            }`}>
                                            {item.stock.Boondall}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded text-sm ${isLowStock(item, 'SevenHills') ? 'bg-red-100 text-red-700' : ''
                                            }`}>
                                            {item.stock.SevenHills}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded text-sm ${isLowStock(item, 'Bayswater') ? 'bg-red-100 text-red-700' : ''
                                            }`}>
                                            {item.stock.Bayswater}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold">
                                        <span className={isLowStock(item) ? 'text-red-600' : 'text-green-600'}>
                                            {getTotalStock(item)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Low Stock Alert */}
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <h3 className="font-bold text-amber-800 mb-2">⚠️ Low Stock Alerts</h3>
                    <ul className="text-sm text-amber-700 space-y-1">
                        {inventory
                            .filter((i) => isLowStock(i))
                            .map((item) => (
                                <li key={item.sku}>
                                    <strong>{item.sku}</strong> - {item.name} (Total: {getTotalStock(item)})
                                </li>
                            ))}
                    </ul>
                </div>
            </main>
        </div>
    );
}
