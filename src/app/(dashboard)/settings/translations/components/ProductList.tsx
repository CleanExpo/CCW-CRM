'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, ChevronLeft, ChevronRight, Languages } from 'lucide-react';
import { TranslationEditDialog } from './TranslationEditDialog';

interface Language {
  code: string;
  name: string;
  native_name: string;
  is_rtl: boolean;
}

interface ProductTranslation {
  id: string;
  sku: string;
  name: string;
  category: string;
  translations: Record<
    string,
    {
      status: string;
      translated_at: string | null;
      translated_by: string | null;
    }
  >;
}

interface ProductListProps {
  languages: Language[];
  onRefresh: () => void;
  defaultFilter?: {
    translation_status?: string;
    language_code?: string;
  };
}

export function ProductList({ languages, onRefresh, defaultFilter }: ProductListProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductTranslation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [languageFilter, setLanguageFilter] = useState(defaultFilter?.language_code || 'all');
  const [statusFilter, setStatusFilter] = useState(defaultFilter?.translation_status || 'all');

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, languageFilter, statusFilter]);

  async function loadProducts() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '20',
      });

      if (search) params.append('search', search);
      if (languageFilter !== 'all') params.append('language_code', languageFilter);
      if (statusFilter !== 'all') params.append('translation_status', statusFilter);

      const response = await apiClient.get<{
        data: ProductTranslation[];
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
      }>(`/api/translations/products?${params}`);

      setProducts(response.data);
      setTotalPages(response.total_pages);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load products',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleSearch() {
    setPage(1);
    loadProducts();
  }

  function getStatusBadge(status: string) {
    const variants: Record<
      string,
      { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }
    > = {
      pending: { variant: 'secondary', label: 'Pending' },
      ai_generated: { variant: 'default', label: 'AI Generated' },
      human_reviewed: { variant: 'outline', label: 'Reviewed' },
      approved: { variant: 'default', label: 'Approved' },
    };

    const config = variants[status] || { variant: 'secondary', label: status };

    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by product name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Select value={languageFilter} onValueChange={setLanguageFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Languages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Languages</SelectItem>
            {languages.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.native_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="ai_generated">AI Generated</SelectItem>
            <SelectItem value="human_reviewed">Human Reviewed</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSearch}>Search</Button>
      </div>

      {/* Products Table */}
      {isLoading ? (
        <div className="py-12 text-center">
          <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground mt-2">Loading products...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center">
          <Languages className="mx-auto mb-4 h-12 w-12 opacity-20" />
          <p>No products found matching your filters</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  {languages.slice(0, 4).map((lang) => (
                    <TableHead key={lang.code} className="text-center">
                      {lang.native_name}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {product.category}
                    </TableCell>
                    {languages.slice(0, 4).map((lang) => (
                      <TableCell key={lang.code} className="text-center">
                        {product.translations[lang.code] ? (
                          getStatusBadge(product.translations[lang.code].status)
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Not Translated
                          </Badge>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <TranslationEditDialog
                        product={product}
                        languages={languages}
                        onSuccess={() => {
                          loadProducts();
                          onRefresh();
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
