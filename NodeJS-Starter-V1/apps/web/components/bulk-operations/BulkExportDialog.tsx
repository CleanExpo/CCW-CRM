/**
 * Bulk Export Dialog
 *
 * Allows exporting selected items with customizable format and fields.
 */

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2 } from "lucide-react";

interface BulkExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onExport: (format: string, options: ExportOptions) => Promise<void>;
  entityName?: string;
  availableFormats?: ExportFormat[];
  availableFields?: ExportField[];
}

interface ExportFormat {
  value: string;
  label: string;
  description?: string;
}

interface ExportField {
  key: string;
  label: string;
  defaultChecked?: boolean;
}

interface ExportOptions {
  includeHeaders: boolean;
  selectedFields: string[];
}

const DEFAULT_FORMATS: ExportFormat[] = [
  { value: "csv", label: "CSV", description: "Comma-separated values" },
  { value: "xlsx", label: "Excel", description: "Microsoft Excel format" },
  { value: "json", label: "JSON", description: "JavaScript Object Notation" },
];

export function BulkExportDialog({
  open,
  onOpenChange,
  selectedCount,
  onExport,
  entityName = "items",
  availableFormats = DEFAULT_FORMATS,
  availableFields = [],
}: BulkExportDialogProps) {
  const { toast } = useToast();
  const [format, setFormat] = useState<string>("csv");
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [selectedFields, setSelectedFields] = useState<string[]>(
    availableFields.filter((f) => f.defaultChecked !== false).map((f) => f.key)
  );
  const [isExporting, setIsExporting] = useState(false);

  const handleToggleField = (fieldKey: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldKey)
        ? prev.filter((k) => k !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const handleToggleAll = () => {
    if (selectedFields.length === availableFields.length) {
      setSelectedFields([]);
    } else {
      setSelectedFields(availableFields.map((f) => f.key));
    }
  };

  const handleExport = async () => {
    if (availableFields.length > 0 && selectedFields.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select at least one field to export",
      });
      return;
    }

    setIsExporting(true);
    try {
      await onExport(format, {
        includeHeaders,
        selectedFields,
      });

      toast({
        title: "Export Successful",
        description: `Exported ${selectedCount} ${entityName} to ${format.toUpperCase()}`,
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: error.message || "Failed to export data",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export {entityName}</DialogTitle>
          <DialogDescription>
            Export {selectedCount} selected {entityName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label htmlFor="format">Export Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableFormats.map((fmt) => (
                  <SelectItem key={fmt.value} value={fmt.value}>
                    <div className="flex flex-col">
                      <span>{fmt.label}</span>
                      {fmt.description && (
                        <span className="text-xs text-muted-foreground">
                          {fmt.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Options */}
          {(format === "csv" || format === "xlsx") && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeHeaders"
                  checked={includeHeaders}
                  onCheckedChange={(checked) => setIncludeHeaders(checked as boolean)}
                />
                <Label
                  htmlFor="includeHeaders"
                  className="text-sm font-normal cursor-pointer"
                >
                  Include column headers
                </Label>
              </div>
            </div>
          )}

          {/* Field Selection */}
          {availableFields.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Fields to Export</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleAll}
                  className="h-8 text-xs"
                >
                  {selectedFields.length === availableFields.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              </div>
              <div className="rounded-md border p-4 max-h-[200px] overflow-y-auto space-y-2">
                {availableFields.map((field) => (
                  <div key={field.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`field-${field.key}`}
                      checked={selectedFields.includes(field.key)}
                      onCheckedChange={() => handleToggleField(field.key)}
                    />
                    <Label
                      htmlFor={`field-${field.key}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {field.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
