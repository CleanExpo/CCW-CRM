/**
 * File Changes Viewer Component
 *
 * Displays files created, modified, and deleted during execution.
 * Color-coded: green (created), yellow (modified), red (deleted)
 */

'use client';

import { FileCheck, FilePlus, FileX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FileChangesViewerProps {
  filesCreated: string[];
  filesModified: string[];
  filesDeleted?: string[];
}

export function FileChangesViewer({
  filesCreated,
  filesModified,
  filesDeleted = [],
}: FileChangesViewerProps) {
  const totalChanges = filesCreated.length + filesModified.length + filesDeleted.length;

  if (totalChanges === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            File Changes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No file changes yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            File Changes
          </span>
          <Badge variant="secondary">{totalChanges} files</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Files Created */}
        {filesCreated.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <FilePlus className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Created ({filesCreated.length})</span>
            </div>
            <ul className="space-y-1">
              {filesCreated.map((file, index) => (
                <li
                  key={index}
                  className="rounded-md bg-green-50 px-3 py-1.5 font-mono text-sm text-green-800"
                >
                  {file}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Files Modified */}
        {filesModified.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium">Modified ({filesModified.length})</span>
            </div>
            <ul className="space-y-1">
              {filesModified.map((file, index) => (
                <li
                  key={index}
                  className="rounded-md bg-yellow-50 px-3 py-1.5 font-mono text-sm text-yellow-800"
                >
                  {file}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Files Deleted */}
        {filesDeleted.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <FileX className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium">Deleted ({filesDeleted.length})</span>
            </div>
            <ul className="space-y-1">
              {filesDeleted.map((file, index) => (
                <li
                  key={index}
                  className="rounded-md bg-red-50 px-3 py-1.5 font-mono text-sm text-red-800 line-through"
                >
                  {file}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
