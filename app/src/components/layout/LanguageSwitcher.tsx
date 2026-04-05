/**
 * Language Switcher Component
 *
 * Allows users to change their preferred language.
 * Sets a cookie and refreshes the page to load new translations.
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { languageConfig, locales, type Locale } from "@/i18n/config";

interface LanguageSwitcherProps {
  currentLocale: Locale;
  variant?: "select" | "dropdown";
}

export function LanguageSwitcher({
  currentLocale,
  variant = "dropdown",
}: LanguageSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedLocale, setSelectedLocale] = useState<Locale>(currentLocale);

  function handleLanguageChange(newLocale: Locale) {
    if (newLocale === selectedLocale) return;

    setSelectedLocale(newLocale);

    startTransition(() => {
      // Set locale cookie
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;

      // Refresh to load new translations
      router.refresh();
    });
  }

  if (variant === "select") {
    return (
      <Select
        value={selectedLocale}
        onValueChange={(value) => handleLanguageChange(value as Locale)}
        disabled={isPending}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue>
            <span className="flex items-center gap-2">
              <span>{languageConfig[selectedLocale].flag}</span>
              <span>{languageConfig[selectedLocale].nativeName}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {locales.map((locale) => (
            <SelectItem key={locale} value={locale}>
              <span className="flex items-center gap-2">
                <span>{languageConfig[locale].flag}</span>
                <span>{languageConfig[locale].nativeName}</span>
                <span className="text-muted-foreground text-xs">
                  ({languageConfig[locale].name})
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2"
          disabled={isPending}
        >
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline">{languageConfig[selectedLocale].flag}</span>
          <span className="hidden md:inline">{languageConfig[selectedLocale].nativeName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[240px]">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleLanguageChange(locale)}
            className="cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="text-lg">{languageConfig[locale].flag}</span>
              <span className="flex-1">{languageConfig[locale].nativeName}</span>
              {locale === selectedLocale && (
                <span className="text-primary">✓</span>
              )}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
