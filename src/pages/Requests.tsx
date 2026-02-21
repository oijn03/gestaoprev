import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Clock, CheckCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CaseRequest {
  id: string;
  status: string;
  description: string | null;
  deadline: string | null;
  created_at: string;
  type: string;
  cases: {
    patient_name: string;
  } | null;
}

export default function Requests() {
  const { user, role } = useAuth();
  const [requests, setRequests] = useState<CaseRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = async () => {
    if (!user || !role) return;
    let query = supabase
      .from("case_requests")
      .select("*, cases(patient_name)")
      .order("created_at", { ascending: false });

    if (role === "advogado") query = query.eq("advogado_id", user.id);
    else if (role === "medico_generalista") query = query.eq("medico_id", user.id);
    else if (role === "especialista") query = query.eq("especialista_id", user.id);

    const { data } = await query;
    if (data) setRequests(data as any[]);
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel("requests-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_requests" },
        () => fetchRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role]);

  const handleAccept = async (request: CaseRequest) => {
    setLoading(true);
    try {
      // 1. Update request status
      const { error: reqError } = await supabase
        .from("case_requests")
        .update({ status: "em_agendamento" })
        .eq("id", request.id);

      if (reqError) throw reqError;

      // 2. Create consultation skeleton
      const { error: consError } = await supabase
        .from("consultations")
        .insert({
          case_request_id: request.id,
          medico_id: user!.id,
          patient_name: request.cases?.patient_name || "Paciente",
          status: "agendada", // Starting as scheduled/pending date
        });

      if (consError) throw consError;

      // 3. Audit log
      await supabase.from("audit_logs").insert({
        user_id: user!.id,
        action: "ACEITAR_SOLICITACAO",
        resource_type: "case_requests",
        resource_id: request.id,
      });

      toast.success("Solicitação aceita! Consulta criada.");
      fetchRequests();
    } catch (error: any) {
      toast.error("Erro ao aceitar solicitação: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAllowEdit = async (request: CaseRequest) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("case_requests")
        .update({ status: "em_ajuste" })
        .eq("id", request.id);

      if (error) throw error;

      toast.success("Edição liberada para o advogado.");
      fetchRequests();
    } catch (error: any) {
      toast.error("Erro ao liberar edição: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    pendente: "bg-warning/10 text-warning",
    em_agendamento: "bg-blue-500/10 text-blue-500",
    em_andamento: "bg-primary/10 text-primary",
    concluida: "bg-success/10 text-success",
    solicitando_ajuste: "bg-destructive/10 text-destructive font-bold animate-pulse",
    em_ajuste: "bg-purple-500/10 text-purple-500",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Solicitações</h1>
        <p className="text-muted-foreground">Gerencie as solicitações de prova técnica</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Prazo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="mx-auto mb-2 h-8 w-8" />
                    Nenhuma solicitação
                  </TableCell>
                </TableRow>
              ) : requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.cases?.patient_name || "—"}</TableCell>
                  <TableCell className="capitalize">{r.type.replace(/_/g, " ")}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[r.status] || ""}>
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {r.deadline ? (
                      <span className="flex items-center gap-1 text-sm"><Clock className="h-3 w-3" />{new Date(r.deadline).toLocaleDateString("pt-BR")}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {role === "medico_generalista" && r.status === "pendente" && (
                      <Button size="sm" onClick={() => handleAccept(r)} disabled={loading}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Aceitar
                      </Button>
                    )}
                    {role === "medico_generalista" && r.status === "solicitando_ajuste" && (
                      <Button size="sm" variant="destructive" onClick={() => handleAllowEdit(r)} disabled={loading}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Permitir Edição
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
