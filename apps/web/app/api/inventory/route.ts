import { NextResponse } from 'next/server';

// Seed inventory data for API
const INVENTORY = [
    { sku: 'TM-PRO-500', name: 'Truckmount Pro 500', category: 'Truckmounts', brand: 'Sapphire', stock: { Boondall: 3, SevenHills: 5, Bayswater: 2 }, price: 18500 },
    { sku: 'RB-COMPACT-200', name: 'Razorback Compact 200', category: 'Portables', brand: 'Razorback', stock: { Boondall: 8, SevenHills: 12, Bayswater: 6 }, price: 2200 },
    { sku: 'AM-PHOENIX-3', name: 'Phoenix Air Mover 3-Speed', category: 'AirMovers', brand: 'Phoenix', stock: { Boondall: 24, SevenHills: 18, Bayswater: 15 }, price: 450 },
    { sku: 'DH-DRIEAZ-1200', name: 'Dri-Eaz LGR 1200', category: 'Dehumidifiers', brand: 'Dri-Eaz', stock: { Boondall: 4, SevenHills: 3, Bayswater: 2 }, price: 1800 },
    { sku: 'CH-PROCHEM-5L', name: 'ProChem Traffic Lane 5L', category: 'Chemicals', brand: 'ProChem', stock: { Boondall: 45, SevenHills: 38, Bayswater: 42 }, price: 85 },
    { sku: 'TM-ULTRA-700', name: 'Truckmount Ultra 700', category: 'Truckmounts', brand: 'Sapphire', stock: { Boondall: 1, SevenHills: 2, Bayswater: 0 }, price: 24500 },
];

export async function GET() {
    return NextResponse.json(INVENTORY);
}
