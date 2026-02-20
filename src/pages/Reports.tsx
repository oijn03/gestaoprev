import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText } from "lucide-react";

interface Report {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
}

export default function Reports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase.from("reports").select("*").eq("author_id", user.id).order("created_at", { ascending: false });
      if (data) setReports(data as Report[]);
    };
    fetch();
  }, [user]);

  const typeLabels: Record<string, string> = { pre_laudo: "Pré-laudo", laudo_final: "Laudo Final" };

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.length === 0 ? (
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
