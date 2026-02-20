import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Clock } from "lucide-react";

interface CaseRequest {
  id: string;
  status: string;
  description: string | null;
  deadline: string | null;
  created_at: string;
  type: string;
}

export default function Requests() {
  const { user, role } = useAuth();
  const [requests, setRequests] = useState<CaseRequest[]>([]);

  useEffect(() => {
    if (!user || !role) return;
    const fetchRequests = async () => {
      let query = supabase.from("case_requests").select("*").order("created_at", { ascending: false });
      if (role === "advogado") query = query.eq("advogado_id", user.id);
      else if (role === "medico_generalista") query = query.eq("medico_id", user.id);
      else if (role === "especialista") query = query.eq("especialista_id", user.id);
      const { data } = await query;
      if (data) setRequests(data as CaseRequest[]);
    };
    fetchRequests();
  }, [user, role]);

  const statusColors: Record<string, string> = {
    pendente: "bg-warning/10 text-warning",
    em_andamento: "bg-primary/10 text-primary",
    concluida: "bg-success/10 text-success",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Solicitações</h1>
        <p className="text-muted-foreground">Solicitações de prova técnica</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Prazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="mx-auto mb-2 h-8 w-8" />
                    Nenhuma solicitação
                  </TableCell>
                </TableRow>
              ) : requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="capitalize">{r.type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.description || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[r.status] || ""}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {r.deadline ? (
                      <span className="flex items-center gap-1 text-sm"><Clock className="h-3 w-3" />{new Date(r.deadline).toLocaleDateString("pt-BR")}</span>
                    ) : "—"}
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
