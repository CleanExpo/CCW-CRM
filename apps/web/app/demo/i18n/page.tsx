/**
 * i18n Demo Page
 *
 * Demonstrates multi-language support with:
 * - Language switcher dropdown
 * - Multiple translation namespaces
 * - RTL support indicator
 * - Common UI elements
 * - Product categories
 * - Order statuses
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "i18n Demo - CCW ERP",
  description: "Multi-language support demonstration with 10 languages",
};
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { defaultLocale, languageConfig, type Locale, isValidLocale } from "@/i18n/config";
import { Globe, CheckCircle2, Clock, Package, AlertCircle } from "lucide-react";

async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("NEXT_LOCALE");

  if (localeCookie?.value && isValidLocale(localeCookie.value)) {
    return localeCookie.value as Locale;
  }

  return defaultLocale;
}

async function getMessages(locale: Locale) {
  try {
    return (await import(`@/i18n/messages/${locale}.json`)).default;
  } catch (error) {
    return (await import(`@/i18n/messages/en.json`)).default;
  }
}

export default async function I18nDemoPage() {
  const locale = await getLocale();
  const messages = await getMessages(locale);
  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = messages;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };
  const currentLang = languageConfig[locale];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-blue-600 flex items-center justify-center">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                CCW ERP - i18n Demo
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Multi-language support demonstration
              </p>
            </div>
          </div>
          <LanguageSwitcher currentLocale={locale} variant="dropdown" />
        </div>

        {/* Current Language Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-4xl">{currentLang.flag}</span>
              <span>Current Language</span>
            </CardTitle>
            <CardDescription>
              Language: {currentLang.name} ({currentLang.nativeName})
              {currentLang.isRTL && (
                <Badge variant="secondary" className="ml-2">
                  RTL Supported
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Language Code:</span>
                <span className="ml-2 font-mono font-semibold">{locale}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Direction:</span>
                <span className="ml-2 font-semibold">
                  {currentLang.isRTL ? "Right-to-Left" : "Left-to-Right"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Common Translations */}
        <Card>
          <CardHeader>
            <CardTitle>{t("common.actions")}</CardTitle>
            <CardDescription>
              Common UI elements from "common" namespace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button>{t("common.save")}</Button>
              <Button variant="outline">{t("common.cancel")}</Button>
              <Button variant="destructive">{t("common.delete")}</Button>
              <Button variant="secondary">{t("common.edit")}</Button>
              <Button variant="ghost">{t("common.create")}</Button>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("common.search")}</p>
                <p className="text-sm text-muted-foreground">{t("common.filter")}</p>
                <p className="text-sm text-muted-foreground">{t("common.refresh")}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("common.export")}</p>
                <p className="text-sm text-muted-foreground">{t("common.import")}</p>
                <p className="text-sm text-muted-foreground">{t("common.viewAll")}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("common.name")}</p>
                <p className="text-sm text-muted-foreground">{t("common.description")}</p>
                <p className="text-sm text-muted-foreground">{t("common.status")}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("common.date")}</p>
                <p className="text-sm text-muted-foreground">{t("common.total")}</p>
                <p className="text-sm text-muted-foreground">{t("common.quantity")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Translations */}
        <Card>
          <CardHeader>
            <CardTitle>{t("navigation.dashboard")}</CardTitle>
            <CardDescription>
              Navigation menu items
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Badge variant="outline" className="justify-center py-2">
                {t("navigation.dashboard")}
              </Badge>
              <Badge variant="outline" className="justify-center py-2">
                {t("navigation.products")}
              </Badge>
              <Badge variant="outline" className="justify-center py-2">
                {t("navigation.customers")}
              </Badge>
              <Badge variant="outline" className="justify-center py-2">
                {t("navigation.orders")}
              </Badge>
              <Badge variant="outline" className="justify-center py-2">
                {t("navigation.quotes")}
              </Badge>
              <Badge variant="outline" className="justify-center py-2">
                {t("navigation.inventory")}
              </Badge>
              <Badge variant="outline" className="justify-center py-2">
                {t("navigation.reports")}
              </Badge>
              <Badge variant="outline" className="justify-center py-2">
                {t("navigation.settings")}
              </Badge>
              <Badge variant="outline" className="justify-center py-2">
                {t("navigation.help")}
              </Badge>
              <Badge variant="outline" className="justify-center py-2">
                {t("navigation.profile")}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Product Categories */}
        <Card>
          <CardHeader>
            <CardTitle>{t("products.title")}</CardTitle>
            <CardDescription>
              Product categories with industry-specific terminology
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                "heavy_machinery",
                "hand_tools",
                "power_tools",
                "safety_equipment",
                "building_materials",
                "electrical",
                "plumbing",
                "accessories",
              ].map((category) => (
                <div
                  key={category}
                  className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                >
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {t(`products.categories.${category}`)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Order Statuses */}
        <Card>
          <CardHeader>
            <CardTitle>{t("orders.title")}</CardTitle>
            <CardDescription>
              Order status translations with icons
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 p-3 rounded-lg border">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">{t("orders.statuses.draft")}</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-sm">{t("orders.statuses.pending")}</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border">
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
                <span className="text-sm">{t("orders.statuses.confirmed")}</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border">
                <Package className="h-4 w-4 text-purple-500" />
                <span className="text-sm">{t("orders.statuses.processing")}</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border">
                <Package className="h-4 w-4 text-indigo-500" />
                <span className="text-sm">{t("orders.statuses.shipped")}</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">{t("orders.statuses.delivered")}</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm">{t("orders.statuses.cancelled")}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dashboard Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.title")}</CardTitle>
            <CardDescription>
              Dashboard section translations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  1,234
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.orders")}
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  5,678
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.customers")}
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-950">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  $123,456
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.revenue")}
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-950">
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  9,012
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.sales")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Messages */}
        <Card>
          <CardHeader>
            <CardTitle>{t("common.error")}</CardTitle>
            <CardDescription>
              Error and validation messages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
                {t("errors.required")}
              </div>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
                {t("errors.invalidEmail")}
              </div>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
                {t("errors.networkError")}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">
                {t("dashboard.welcome")} 👋
              </p>
              <p className="text-sm opacity-90">
                Switch languages using the dropdown in the top-right corner
              </p>
              <div className="pt-4">
                <Badge variant="secondary" className="text-xs">
                  10 Languages Supported
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
