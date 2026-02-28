import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Document {
  id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  file_path: string;
  description: string | null;
  created_at: string;
  // Bug #6 fix: joined from cases table
  cases: { title: string } | null;
}

export default function Documents() {
  const { user } = useAuth();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("documents")
        .select("*, cases(title)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Document[];
    },
    enabled: !!user,
  });

  const handleDownload = async (doc: Document) => {
    const { data, error } = await supabase.storage.from("case-documents").download(doc.file_path);
    if (error) { toast.error("Erro ao baixar arquivo"); return; }

    // Log audit
    await supabase.from("audit_logs").insert({
      user_id: user!.id,
      action: "download",
      resource_type: "document",
      resource_id: doc.id,
      details: { file_name: doc.file_name },
    });

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.file_name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-2 text-muted-foreground">Carregando documentos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documentos</h1>
        <p className="text-muted-foreground">Arquivos dos casos</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead className="hidden md:table-cell">Caso</TableHead>
                <TableHead className="hidden md:table-cell">Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Tamanho</TableHead>
                <TableHead className="hidden lg:table-cell">Data</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!documents || documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <FileText className="mx-auto mb-2 h-8 w-8" />
                    Nenhum documento
                  </TableCell>
                </TableRow>
              ) : documents.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.file_name}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {d.cases?.title || "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{d.file_type || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{formatSize(d.file_size)}</TableCell>
                  <TableCell className="hidden lg:table-cell">{new Date(d.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleDownload(d)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
