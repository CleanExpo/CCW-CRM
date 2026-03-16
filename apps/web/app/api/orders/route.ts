import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "50");
    const search = searchParams.get("search");
    const status = searchParams.get("status");

    let query = supabase.from("orders").select("*, customers(company_name)", { count: "exact" });

    if (search) {
      query = query.or(`order_number.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq("status", status);
    }

    query = query
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    // Flatten customer name into order
    const orders = (data ?? []).map((o) => ({
      ...o,
      customer_name: (o.customers as { company_name: string } | null)?.company_name ?? "Unknown",
      customers: undefined,
    }));

    return NextResponse.json({
      items: orders,
      total: count ?? 0,
      page,
      page_size: pageSize,
      total_pages: Math.ceil((count ?? 0) / pageSize),
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await request.json();
    const { data, error } = await supabase.from("orders").insert(body).select().single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
