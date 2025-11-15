import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet } from "lucide-react";

interface ExtractedTable {
  id: string;
  headers: string[];
  rows: string[][];
  caption?: string;
  position: string;
}

interface WordTablesPreviewProps {
  tables: ExtractedTable[];
  fileName: string;
}

export const WordTablesPreview = ({ tables, fileName }: WordTablesPreviewProps) => {
  if (!tables || tables.length === 0) return null;

  return (
    <Card className="mt-3 border-muted max-h-[400px] flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Tabelas Extraídas</CardTitle>
        </div>
        <CardDescription className="text-xs">
          {tables.length} {tables.length === 1 ? "tabela encontrada" : "tabelas encontradas"} em {fileName}
        </CardDescription>
      </CardHeader>
      <ScrollArea className="flex-1 min-h-0">
        <CardContent className="space-y-4">
          {tables.map((table, idx) => (
          <div key={table.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Tabela {idx + 1}
              </Badge>
              {table.caption && (
                <span className="text-xs text-muted-foreground">{table.caption}</span>
              )}
            </div>
            <ScrollArea className="w-full rounded-md border">
              <div className="max-h-[300px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {table.headers.map((header, headerIdx) => (
                        <TableHead key={headerIdx} className="text-xs font-semibold whitespace-nowrap">
                          {header || `Coluna ${headerIdx + 1}`}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {table.rows.slice(0, 10).map((row, rowIdx) => (
                      <TableRow key={rowIdx}>
                        {row.map((cell, cellIdx) => (
                          <TableCell key={cellIdx} className="text-xs whitespace-nowrap">
                            {cell || "-"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
            {table.rows.length > 10 && (
              <p className="text-xs text-muted-foreground text-center">
                ... e mais {table.rows.length - 10} {table.rows.length - 10 === 1 ? "linha" : "linhas"}
              </p>
            )}
          </div>
        ))}
        </CardContent>
      </ScrollArea>
    </Card>
  );
};
