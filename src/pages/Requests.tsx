import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { MessageSquare, XCircle, Loader2, Clock, Calendar, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format, addMinutes } from "date-fns";
import CaseHub from "@/components/CaseHub";
import { CaseRequest } from "@/types/case-hub";

export default function Requests() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCaseName, setSelectedCaseName] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
  const [requestToAccept, setRequestToAccept] = useState<CaseRequest | null>(null);
  const [schedulingData, setSchedulingData] = useState({
    consultationDate: "",
    forecastDate: ""
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ["case-requests", user?.id, role],
    queryFn: async () => {
      if (!user || !role) return [];
      let query = supabase
        .from("case_requests")
        .select("*, cases(id, patient_name, patient_cpf, process_number, title, description)")
        .order("created_at", { ascending: false });

      if (role === "advogado") query = query.eq("advogado_id", user.id);
      else if (role === "medico_generalista") query = query.eq("medico_id", user.id);
      else if (role === "especialista") query = query.eq("especialista_id", user.id);

      const { data, error } = await query;
      if (error) throw error;
      return data as CaseRequest[];
    },
    enabled: !!user && !!role,
  });

  // Realtime para atualizações na lista
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("requests-main").on("postgres_changes", { event: "*", schema: "public", table: "case_requests" },
      () => queryClient.invalidateQueries({ queryKey: ["case-requests"] })).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const acceptMutation = useMutation({
    mutationFn: async ({ request, consultationDate, forecastDate }: { request: CaseRequest, consultationDate: string, forecastDate: string }) => {
      const { data: reqFull } = await supabase.from("case_requests").select("advogado_id").eq("id", request.id).single();
      const { error: reqError } = await supabase.from("case_requests").update({ status: "em_agendamento", report_forecast_date: forecastDate }).eq("id", request.id);
      if (reqError) throw reqError;

      const { error: consError } = await supabase.from("consultations").insert({
        case_request_id: request.id,
        medico_id: user!.id,
        patient_name: request.cases?.patient_name || "Paciente",
        status: "agendada",
        scheduled_at: consultationDate
      });
      if (consError) throw consError;

      if (reqFull?.advogado_id) {
        await supabase.rpc("notify_user_fn", {
          p_user_id: reqFull.advogado_id,
          p_title: "Solicitação Aceita",
          p_message: `O médico aceitou a solicitação para "${request.cases?.patient_name}".`,
          p_type: "success",
          p_link: "/solicitacoes",
        });
      }
    },
    onSuccess: () => {
      toast.success("Solicitação aceita!");
      setIsAcceptDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["case-requests"] });
    },
    onError: (err: any) => toast.error("Erro: " + err.message)
  });

  const allowEditMutation = useMutation({
    mutationFn: async (request: CaseRequest) => {
      await supabase.from("case_requests").update({ status: "em_ajuste" }).eq("id", request.id);
    },
    onSuccess: () => { toast.success("Edição liberada."); queryClient.invalidateQueries({ queryKey: ["case-requests"] }); }
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ request, confirmAction }: { request: CaseRequest, confirmAction: boolean }) => {
      if (confirmAction) {
        await supabase.from("case_requests").delete().eq("id", request.id);
      } else {
        await supabase.from("case_requests").update({ status: "solicitando_cancelamento", cancel_requested_by: user!.id }).eq("id", request.id);
      }
    },
    onSuccess: () => {
      toast.success("Ação de cancelamento realizada.");
      queryClient.invalidateQueries({ queryKey: ["case-requests"] });
    }
  });

  const statusColors: Record<string, string> = {
    pendente: "bg-warning/10 text-warning",
    em_agendamento: "bg-primary/10 text-primary",
    em_andamento: "bg-primary/10 text-primary",
    concluida: "bg-success/10 text-success",
    solicitando_ajuste: "bg-destructive/10 text-destructive font-bold animate-pulse",
    solicitando_cancelamento: "bg-destructive/10 text-destructive font-bold animate-pulse",
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Solicitações</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests?.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 opacity-50">Nenhuma solicitação</TableCell></TableRow>
              ) : requests?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.cases?.patient_name || "—"}</TableCell>
                  <TableCell className="capitalize">{r.type.replace(/_/g, " ")}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="secondary" className={statusColors[r.status] || ""}>{r.status.replace(/_/g, " ")}</Badge>
                      {r.report_forecast_date && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 font-medium bg-primary/5 px-2 py-0.5 rounded border border-primary/10 w-fit">
                          <Clock className="h-2 w-2" /> Laudo: {format(new Date(r.report_forecast_date), "dd/MM")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => {
                        setSelectedCaseId(r.case_id);
                        setSelectedCaseName(r.cases?.patient_name || "Paciente");
                        setIsHistoryOpen(true);
                      }}><MessageSquare className="h-4 w-4" /></Button>

                      {role === "medico_generalista" && (
                        <>
                          {r.status === "pendente" && (
                            <Button size="sm" onClick={() => {
                              setRequestToAccept(r);
                              setSchedulingData({
                                consultationDate: addMinutes(new Date(), 60).toISOString().slice(0, 16),
                                forecastDate: addMinutes(new Date(), 60 * 24 * 3).toISOString().slice(0, 16)
                              });
                              setIsAcceptDialogOpen(true);
                            }}>Aceitar e Agendar</Button>
                          )}
                          {r.status === "solicitando_ajuste" && (
                            <Button size="sm" variant="destructive" onClick={() => allowEditMutation.mutate(r)}>Liberar Edição</Button>
                          )}
                          {r.status !== "pendente" && r.status !== "concluida" && (
                            <Button size="sm" variant={r.status === "solicitando_cancelamento" ? "destructive" : "outline"}
                              onClick={() => cancelMutation.mutate({ request: r, confirmAction: r.status === "solicitando_cancelamento" && r.cancel_requested_by !== user?.id })}>
                              {r.status === "solicitando_cancelamento" && r.cancel_requested_by !== user?.id ? "Confirmar Canc." : "Cancelar"}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAcceptDialogOpen} onOpenChange={setIsAcceptDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Aceitar e Agendar</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Consulta</Label>
              <Input type="datetime-local" value={schedulingData.consultationDate} onChange={(e) => setSchedulingData({ ...schedulingData, consultationDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Previsão Laudo</Label>
              <Input type="datetime-local" value={schedulingData.forecastDate} onChange={(e) => setSchedulingData({ ...schedulingData, forecastDate: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAcceptDialogOpen(false)}>Sair</Button>
            <Button disabled={acceptMutation.isPending} onClick={() => acceptMutation.mutate({ request: requestToAccept!, consultationDate: schedulingData.consultationDate, forecastDate: schedulingData.forecastDate })}>
              {acceptMutation.isPending ? "Processando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CaseHub caseId={selectedCaseId} caseName={selectedCaseName} open={isHistoryOpen} onOpenChange={setIsHistoryOpen} />
    </div>
  );
}
