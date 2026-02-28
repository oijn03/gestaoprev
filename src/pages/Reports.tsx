import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Report {
  id: string;
  title: string;
  type: string;
  status: string;
  file_path: string | null;
  created_at: string;
}

export default function Reports() {
  const { user, role } = useAuth();

  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports", user?.id, role],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (role === "advogado") {
        // Bug #11 fix: Advogado vê laudos relacionados aos seus casos
        // Buscamos primeiro os IDs de requisições do advogado
        const { data: reqs } = await supabase
          .from("case_requests")
          .select("id")
          .eq("advogado_id", user.id);

        const reqIds = reqs?.map(r => r.id) || [];
        if (reqIds.length === 0) return [];

        query = query.in("case_request_id", reqIds);
      } else {
        // Médicos/Especialistas veem o que eles mesmos criaram
        query = query.eq("author_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Report[];
    },
    enabled: !!user,
  });

  const typeLabels: Record<string, string> = { pre_laudo: "Pré-laudo", laudo_final: "Laudo Final" };

  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-2 text-muted-foreground">Carregando laudos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Laudos</h1>
        <p className="text-muted-foreground">Pré-laudos e laudos finais</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!reports || reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    <FileText className="mx-auto mb-2 h-8 w-8" />
                    Nenhum laudo
                  </TableCell>
                </TableRow>
              ) : reports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell><Badge variant="secondary">{typeLabels[r.type] || r.type}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right">
                    {r.file_path && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            const { data, error } = await supabase.storage
                              .from("reports")
                              .createSignedUrl(r.file_path!, 3600);
                            if (error) throw error;
                            window.open(data.signedUrl, '_blank');
                          } catch (err: any) {
                            toast.error("Erro ao abrir laudo: " + err.message);
                          }
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
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
