import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, FolderOpen, AlertTriangle, Clock, Search, Stethoscope,
  History, CheckCircle2, Lock, Trash2, XCircle, Check, MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { startOfMinute, isBefore } from "date-fns";
import CaseHub from "@/components/CaseHub";

interface Case {
  id: string;
  title: string;
  patient_name: string;
  patient_cpf: string | null;
  process_number: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  description: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  aberto: "bg-primary/10 text-primary",
  em_andamento: "bg-warning/10 text-warning",
  aguardando_medico: "bg-warning/10 text-warning",
  aguardando_laudo: "bg-warning/10 text-warning",
  em_agendamento: "bg-primary/10 text-primary",
  em_ajuste: "bg-accent text-accent-foreground",
  solicitando_ajuste: "bg-destructive/10 text-destructive",
  solicitando_cancelamento: "bg-destructive/10 text-destructive font-bold animate-pulse",
  concluido: "bg-success/10 text-success",
  concluida: "bg-success/10 text-success",
  arquivado: "bg-muted text-muted-foreground",
};

const priorityColors: Record<string, string> = {
  normal: "bg-muted text-muted-foreground",
  alta: "bg-warning/10 text-warning",
  urgente: "bg-destructive/10 text-destructive",
};

export default function Cases() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [currentRequestStatus, setCurrentRequestStatus] = useState<string | null>(null);
  const [cancelRequestedBy, setCancelRequestedBy] = useState<string | null>(null);

  // CaseHub state
  const [hubOpen, setHubOpen] = useState(false);
  const [hubCaseId, setHubCaseId] = useState<string | null>(null);
  const [hubCaseName, setHubCaseName] = useState("");

  const [form, setForm] = useState({ title: "", patient_name: "", patient_cpf: "", process_number: "", description: "", priority: "normal", deadline: "" });
  const [requestForm, setRequestForm] = useState({ medico_id: "", type: "prova_tecnica", deadline: "", description: "" });
  const [docFiles, setDocFiles] = useState<Record<string, File | null>>({
    identificacao: null, endereco: null, laudos: null, exames: null, receitas: null,
  });

  // Fetch cases with useQuery
  const { data: cases = [] } = useQuery({
    queryKey: ["cases", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("cases").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Case[];
    },
    enabled: !!user,
  });

  // Fetch doctors
  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors-list"],
    queryFn: async () => {
      const { data: roleRecords } = await supabase.from("user_roles").select("user_id").eq("role", "medico_generalista");
      if (!roleRecords?.length) return [];
      const { data: profileRecords } = await supabase.from("profiles").select("user_id, full_name").in("user_id", roleRecords.map(r => r.user_id));
      return profileRecords?.map(d => ({ id: d.user_id, full_name: d.full_name })) || [];
    },
  });

  const isLocked = currentRequestStatus !== null &&
    currentRequestStatus !== "pendente" &&
    currentRequestStatus !== "em_ajuste" &&
    currentRequestStatus !== "solicitando_cancelamento";

  const canSubmit = requestForm.medico_id && requestForm.deadline && docFiles.identificacao && docFiles.endereco;

  const docCategories = [
    { id: "identificacao", label: "Documento de Identificação (com CPF)", required: true },
    { id: "endereco", label: "Comprovante de Endereço", required: true },
    { id: "laudos", label: "Laudos/Atestados Anteriores", required: false },
    { id: "exames", label: "Exames Prévios", required: false },
    { id: "receitas", label: "Receitas Prévias", required: false },
  ];

  // Create case mutation
  const createCaseMutation = useMutation({
    mutationFn: async (formData: typeof form) => {
      if (!user) throw new Error("Usuário não autenticado");
      const { error } = await supabase.from("cases").insert({
        user_id: user.id, title: formData.title, patient_name: formData.patient_name,
        patient_cpf: formData.patient_cpf || null, process_number: formData.process_number || null,
        description: formData.description || null, priority: formData.priority, deadline: formData.deadline || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Caso criado com sucesso!");
      setDialogOpen(false);
      setForm({ title: "", patient_name: "", patient_cpf: "", process_number: "", description: "", priority: "normal", deadline: "" });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Create/update request mutation
  const createRequestMutation = useMutation({
    mutationFn: async (data: typeof requestForm & { case_id: string }) => {
      let request;
      if (editingRequestId) {
        const { data: updated, error } = await supabase.from("case_requests")
          .update({ medico_id: data.medico_id, type: data.type, deadline: data.deadline, description: data.description })
          .eq("id", editingRequestId).select().single();
        if (error) throw error;
        request = updated;
      } else {
        const { data: created, error } = await supabase.from("case_requests").insert({
          case_id: data.case_id, advogado_id: user!.id, medico_id: data.medico_id,
          type: data.type, status: "pendente", deadline: data.deadline, description: data.description,
        }).select().single();
        if (error) throw error;
        request = created;
      }

      // Upload documents
      for (const [category, file] of Object.entries(docFiles)) {
        if (!file) continue;
        const fileExt = file.name.split('.').pop();
        const fileName = `${data.case_id}/${category}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `documents/${fileName}`;
        const { error: uploadError } = await supabase.storage.from("case-documents").upload(filePath, file);
        if (uploadError) continue;
        await supabase.from("documents").insert({
          case_id: data.case_id, file_name: file.name, file_path: filePath,
          file_type: file.type, file_size: file.size, description: category, uploaded_by: user!.id,
        });
      }

      // Notify doctor
      if (!editingRequestId) {
        await supabase.rpc("notify_user_fn", {
          p_user_id: data.medico_id,
          p_title: "Nova Solicitação",
          p_message: `O advogado solicitou uma nova prova técnica para o caso "${selectedCase?.title}".`,
          p_type: "info", p_link: "/solicitacoes",
        });
      }
      return request;
    },
    onSuccess: () => {
      toast.success(editingRequestId ? "Solicitação atualizada!" : "Solicitação enviada!");
      setRequestDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const handleOpenEditRequest = async (c: Case) => {
    setSelectedCase(c);
    setEditingRequestId(null);
    setCurrentRequestStatus(null);
    setCancelRequestedBy(null);
    setRequestForm({ medico_id: "", type: "prova_tecnica", deadline: "", description: "" });
    setDocFiles({ identificacao: null, endereco: null, laudos: null, exames: null, receitas: null });

    const { data: request } = await supabase.from("case_requests").select("*").eq("case_id", c.id).maybeSingle();
    if (request) {
      setEditingRequestId(request.id);
      setCurrentRequestStatus(request.status);
      setCancelRequestedBy(request.cancel_requested_by);
      setRequestForm({
        medico_id: request.medico_id || "", type: request.type,
        deadline: request.deadline ? request.deadline.slice(0, 16) : "", description: request.description || "",
      });
    }
    setRequestDialogOpen(true);
  };

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    if (requestForm.deadline) {
      const deadlineDate = new Date(requestForm.deadline);
      if (isBefore(deadlineDate, startOfMinute(new Date()))) {
        toast.error("O prazo não pode ser uma data retroativa");
        return;
      }
    }
    createRequestMutation.mutate({ ...requestForm, case_id: selectedCase.id });
  };

  const handleRequestAdjustment = async () => {
    if (!editingRequestId || !selectedCase) return;
    try {
      const { data: reqData } = await supabase.from("case_requests").select("medico_id").eq("id", editingRequestId).single();
      const { error } = await supabase.from("case_requests").update({ status: "solicitando_ajuste" }).eq("id", editingRequestId);
      if (error) throw error;
      if (reqData?.medico_id) {
        await supabase.rpc("notify_user_fn", {
          p_user_id: reqData.medico_id, p_title: "Solicitação de Alteração",
          p_message: `O advogado solicitou alterações na prova técnica do caso "${selectedCase.title}".`,
          p_type: "warning", p_link: "/solicitacoes",
        });
      }
      toast.success("Solicitação de alteração enviada ao médico!");
      setCurrentRequestStatus("solicitando_ajuste");
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    } catch (error: any) { toast.error("Erro: " + error.message); }
  };

  const handleDeleteRequest = async () => {
    if (!editingRequestId) return;
    if (!confirm("Tem certeza que deseja excluir esta solicitação?")) return;
    try {
      const { error } = await supabase.from("case_requests").delete().eq("id", editingRequestId);
      if (error) throw error;
      toast.success("Solicitação excluída!");
      setRequestDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    } catch (error: any) { toast.error("Erro: " + error.message); }
  };

  const handleCancelRequest = async (confirmAction: boolean = false) => {
    if (!editingRequestId || !selectedCase) return;
    try {
      if (confirmAction) {
        const { error } = await supabase.from("case_requests").delete().eq("id", editingRequestId);
        if (error) throw error;
        toast.success("Solicitação cancelada!");
        if (requestForm.medico_id) {
          await supabase.rpc("notify_user_fn", {
            p_user_id: requestForm.medico_id, p_title: "Cancelamento Confirmado",
            p_message: `O advogado aceitou o cancelamento do caso "${selectedCase.title}".`, p_type: "info",
          });
        }
      } else {
        const { error } = await supabase.from("case_requests").update({ status: "solicitando_cancelamento", cancel_requested_by: user!.id }).eq("id", editingRequestId);
        if (error) throw error;
        toast.success("Pedido de cancelamento enviado!");
        if (requestForm.medico_id) {
          await supabase.rpc("notify_user_fn", {
            p_user_id: requestForm.medico_id, p_title: "Pedido de Cancelamento",
            p_message: `O advogado solicitou cancelamento do caso "${selectedCase.title}".`,
            p_type: "warning", p_link: "/solicitacoes",
          });
        }
      }
      setRequestDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    } catch (error: any) { toast.error("Erro: " + error.message); }
  };

  const filtered = cases.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.patient_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meus Casos</h1>
          <p className="text-muted-foreground">Gerencie seus casos previdenciários</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="min-h-[44px]"><Plus className="mr-2 h-4 w-4" /> Novo Caso</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Criar Novo Caso</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createCaseMutation.mutate(form); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Título do Caso</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Paciente</Label>
                  <Input value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} required maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={form.patient_cpf} onChange={(e) => setForm({ ...form, patient_cpf: e.target.value })} maxLength={14} placeholder="000.000.000-00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nº Processo</Label>
                  <Input value={form.process_number} onChange={(e) => setForm({ ...form, process_number: e.target.value })} maxLength={30} />
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Prazo Fatal</Label>
                <Input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} rows={3} />
              </div>
              <Button type="submit" className="w-full min-h-[44px]" disabled={createCaseMutation.isPending}>
                {createCaseMutation.isPending ? "Criando..." : "Criar Caso"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por título ou paciente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caso</TableHead>
                <TableHead className="hidden md:table-cell">Paciente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead className="hidden lg:table-cell">Prazo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <FolderOpen className="mx-auto mb-2 h-8 w-8" />
                    Nenhum caso encontrado
                  </TableCell>
                </TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground md:hidden">{c.patient_name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{c.patient_name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[c.status] || ""}>{c.status.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={priorityColors[c.priority] || ""}>{c.priority}</Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {c.deadline ? (
                      <span className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {new Date(c.deadline).toLocaleDateString("pt-BR")}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setHubCaseId(c.id); setHubCaseName(c.patient_name); setHubOpen(true); }}>
                      <MessageSquare className="mr-2 h-4 w-4" />Hub
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleOpenEditRequest(c)}>
                      <Stethoscope className="mr-2 h-4 w-4" />
                      {c.status === "aberto" || c.status === "em_andamento" ? "Solicitar Prova" : "Ver Solicitação"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Request Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRequestId ? "Ver/Editar Solicitação" : "Solicitar Prova Técnica"}</DialogTitle>
            <DialogDescription>
              {isLocked ? "Solicitação bloqueada para edição." : "Selecione um médico e defina o prazo para a perícia."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRequest} className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center">Médico Generalista {isLocked && <Lock className="ml-2 h-3 w-3 text-muted-foreground" />}</Label>
              <Select value={requestForm.medico_id} onValueChange={(v) => setRequestForm({ ...requestForm, medico_id: v })} disabled={isLocked}>
                <SelectTrigger><SelectValue placeholder="Selecione um médico..." /></SelectTrigger>
                <SelectContent>
                  {doctors.map((doc) => <SelectItem key={doc.id} value={doc.id}>{doc.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center">Tipo de Perícia {isLocked && <Lock className="ml-2 h-3 w-3 text-muted-foreground" />}</Label>
              <Input value={requestForm.type} onChange={(e) => setRequestForm({ ...requestForm, type: e.target.value })} required disabled={isLocked} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center">Prazo Esperado {isLocked && <Lock className="ml-2 h-3 w-3 text-muted-foreground" />}</Label>
              <Input type="datetime-local" value={requestForm.deadline} onChange={(e) => setRequestForm({ ...requestForm, deadline: e.target.value })} required disabled={isLocked} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center">Observações {isLocked && <Lock className="ml-2 h-3 w-3 text-muted-foreground" />}</Label>
              <Textarea value={requestForm.description} onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })} rows={3} disabled={isLocked} />
            </div>

            {!editingRequestId && (
              <div className="space-y-4 border-t pt-4">
                <Label className="text-base font-semibold">Anexos Obrigatórios e Opcionais</Label>
                <div className="grid gap-4 max-h-[300px] overflow-y-auto pr-2">
                  {docCategories.map((cat) => (
                    <div key={cat.id} className="space-y-1.5">
                      <Label className="text-xs">{cat.label} {cat.required && "*"}</Label>
                      <Input type="file" onChange={(e) => setDocFiles({ ...docFiles, [cat.id]: e.target.files?.[0] || null })} required={cat.required} className="text-xs h-8" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              {editingRequestId && currentRequestStatus === "pendente" && (
                <Button type="button" variant="destructive" onClick={handleDeleteRequest} className="w-full sm:w-auto">
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </Button>
              )}
              {isLocked || currentRequestStatus === "solicitando_cancelamento" ? (
                <>
                  {currentRequestStatus === "solicitando_cancelamento" ? (
                    cancelRequestedBy === user?.id ? (
                      <Button type="button" variant="outline" className="w-full" disabled>
                        <Clock className="mr-2 h-4 w-4" /> Aguardando Confirmação
                      </Button>
                    ) : (
                      <Button type="button" variant="destructive" className="w-full" onClick={() => handleCancelRequest(true)}>
                        <Check className="mr-2 h-4 w-4" /> Confirmar Cancelamento
                      </Button>
                    )
                  ) : (
                    <div className="flex w-full gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => handleCancelRequest(false)}>
                        <XCircle className="mr-2 h-4 w-4" /> Cancelar
                      </Button>
                      <Button type="button" className="flex-1" onClick={handleRequestAdjustment} disabled={currentRequestStatus === "solicitando_ajuste"}>
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        {currentRequestStatus === "solicitando_ajuste" ? "Aguardando..." : "Alterar"}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <Button type="submit" className="w-full min-h-[44px]" disabled={createRequestMutation.isPending || (!editingRequestId && !canSubmit)}>
                  {createRequestMutation.isPending ? "Salvando..." : editingRequestId ? "Salvar Alterações" : "Enviar Solicitação"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CaseHub replaces the old duplicate Sheet */}
      <CaseHub caseId={hubCaseId} caseName={hubCaseName} open={hubOpen} onOpenChange={setHubOpen} />
    </div>
  );
}
