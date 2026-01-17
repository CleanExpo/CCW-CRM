"use client";

import * as React from "react";
import Image from "next/image";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function PlaygroundPage() {
  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        
        .font-display {
          font-family: 'Poppins', sans-serif;
        }
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
      `}</style>

      <div className="min-h-screen bg-background-light dark:bg-background-dark font-display text-gray-800 dark:text-white">
        <header className="bg-white dark:bg-gray-800 shadow-sm z-10 p-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <button className="text-gray-600 dark:text-gray-300">
                <span className="material-symbols-outlined">search</span>
              </button>
              <button className="relative text-gray-600 dark:text-gray-300">
                <span className="material-symbols-outlined">notifications</span>
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800"></span>
              </button>
              <Image
                alt="User avatar"
                className="h-8 w-8 rounded-full"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAGjv0lyYxKWDu7fXTmChgG3DngKhUHqB11vNoqI_FCLar1D9g5Dfj1BLSaDJrQ7HBTBX1VLfOIjylAOUBuAdxRp4bMmU9tlxdYJyNcgAPGNxY5tqLM2Zs5F66FD3cIxSBTWCGFJfeS3ChgKL00SfrBZ24XPii_K7o5nLSSHr6ESeJrTjefVwYxM4UMd2yVmcEIzIH51kqsCbLg_FnnHRf7r950H1C8VjPvgdO0URbGfHepyoAKE-qb8k68B_BaPtHjHVJLVopPxH0"
                width={32}
                height={32}
              />
            </div>
          </div>
        </header>
        <main className="p-4 space-y-6">
          <section>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm flex flex-col items-start space-y-2">
                <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-full">
                  <span className="material-symbols-outlined text-blue-500 dark:text-blue-400">
                    monitoring
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Sales</p>
                <p className="text-lg font-bold">$345,678</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm flex flex-col items-start space-y-2">
                <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-full">
                  <span className="material-symbols-outlined text-green-500 dark:text-green-400">
                    receipt_long
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Avg. Order Value</p>
                <p className="text-lg font-bold">$123.50</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm flex flex-col items-start space-y-2">
                <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-full">
                  <span className="material-symbols-outlined text-purple-500 dark:text-purple-400">
                    conversion_path
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Conversion Rate</p>
                <p className="text-lg font-bold">3.14%</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm flex flex-col items-start space-y-2">
                <div className="bg-orange-100 dark:bg-orange-900/50 p-2 rounded-full">
                  <span className="material-symbols-outlined text-orange-500 dark:text-orange-400">
                    shopping_cart
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">New Orders</p>
                <p className="text-lg font-bold">72</p>
              </div>
            </div>
          </section>
          <section>
            <div className="grid grid-cols-4 gap-4 text-center">
              <a href="#" className="flex flex-col items-center space-y-1 text-gray-700 dark:text-gray-300">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-full shadow-sm">
                  <span className="material-symbols-outlined text-primary">add_shopping_cart</span>
                </div>
                <span className="text-xs">New Order</span>
              </a>
              <a href="#" className="flex flex-col items-center space-y-1 text-gray-700 dark:text-gray-300">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-full shadow-sm">
                  <span className="material-symbols-outlined text-primary">inventory_2</span>
                </div>
                <span className="text-xs">Inventory</span>
              </a>
              <a href="#" className="flex flex-col items-center space-y-1 text-gray-700 dark:text-gray-300">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-full shadow-sm">
                  <span className="material-symbols-outlined text-primary">group</span>
                </div>
                <span className="text-xs">Customers</span>
              </a>
              <a href="#" className="flex flex-col items-center space-y-1 text-gray-700 dark:text-gray-300">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-full shadow-sm">
                  <span className="material-symbols-outlined text-primary">analytics</span>
                </div>
                <span className="text-xs">Reports</span>
              </a>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold">Recent Activities</h2>
              <a href="#" className="text-sm text-primary">
                View all
              </a>
            </div>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-full">
                  <span className="material-symbols-outlined text-gray-600 dark:text-gray-300">
                    storefront
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">New In-Store Purchase</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    John Smith - #ORD-56789
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">$150.00</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">2 min ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-full">
                  <span className="material-symbols-outlined text-gray-600 dark:text-gray-300">
                    shopping_bag
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Shopify Order</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Jane Doe - #SHOPIFY-1234
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">$89.99</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">15 min ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-full">
                  <span className="material-symbols-outlined text-gray-600 dark:text-gray-300">
                    chat
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">New Customer Inquiry</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Bob Johnson</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">1 hour ago</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold">Sales Pipeline</h2>
              <a href="#" className="text-sm text-primary">
                Details
              </a>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-300">New Leads</span>
                  <span className="font-medium">15</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: "25%" }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-300">Contacted</span>
                  <span className="font-medium">25</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full" style={{ width: "45%" }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-300">Proposal Sent</span>
                  <span className="font-medium">12</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full" style={{ width: "20%" }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-300">Won</span>
                  <span className="font-medium">8</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: "10%" }}></div>
                </div>
              </div>
            </div>
          </section>

          {/* Backend Connection Status (Preserved from previous step) */}
          <section className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <h2 className="font-bold mb-4">System Status</h2>
            <BackendStatus />
          </section>
        </main>

        <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-2">
          <nav className="flex justify-around">
            <a href="#" className="flex flex-col items-center text-primary">
              <span className="material-symbols-outlined">dashboard</span>
              <span className="text-xs">Dashboard</span>
            </a>
            <a href="#" className="flex flex-col items-center text-gray-500 dark:text-gray-400">
              <span className="material-symbols-outlined">receipt_long</span>
              <span className="text-xs">Orders</span>
            </a>
            <a href="#" className="flex flex-col items-center text-gray-500 dark:text-gray-400">
              <span className="material-symbols-outlined">group</span>
              <span className="text-xs">Customers</span>
            </a>
            <a href="#" className="flex flex-col items-center text-gray-500 dark:text-gray-400">
              <span className="material-symbols-outlined">settings</span>
              <span className="text-xs">Settings</span>
            </a>
          </nav>
        </footer>
      </div>
    </>
  );
}

function BackendStatus() {
  const [status, setStatus] = React.useState<"loading" | "connected" | "error">("loading");
  const [message, setMessage] = React.useState<string>("");

  React.useEffect(() => {
    fetch(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error(`Failed to connect: ${res.status} ${res.statusText}`);
      })
      .then((data) => {
        setStatus("connected");
        setMessage(data.message || JSON.stringify(data));
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message);
      });
  }, []);

  if (status === "loading") {
    return <div className="text-xs text-gray-500">Checking connection...</div>;
  }

  if (status === "connected") {
    return (
      <div className="flex items-center text-xs text-green-600 dark:text-green-400">
        <span className="material-symbols-outlined text-[16px] mr-1">check_circle</span>
        Connected to Backend
      </div>
    )
  }

  return (
    <div className="flex items-center text-xs text-red-500">
      <span className="material-symbols-outlined text-[16px] mr-1">error</span>
      Error: {message} (API: {process.env.NEXT_PUBLIC_API_URL})
    </div>
  );
}
