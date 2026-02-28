import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  History, FileText, CheckCircle2, Lock, Trash2, XCircle, Check
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addMinutes, isBefore, startOfMinute, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, MessageSquare } from "lucide-react";

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

interface TimelineEvent {
  id: string;
  type: 'creation' | 'request' | 'acceptance' | 'document';
  title: string;
  description: string;
  date: string;
  icon: any;
}

interface CaseMessage {
  id: string;
  case_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

const statusColors: Record<string, string> = {
  aberto: "bg-primary/10 text-primary",
  em_andamento: "bg-warning/10 text-warning",
  aguardando_medico: "bg-warning/10 text-warning",
  aguardando_laudo: "bg-warning/10 text-warning",
  em_agendamento: "bg-primary/10 text-primary",
  em_ajuste: "bg-purple-500/10 text-purple-500",
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
  const [cases, setCases] = useState<Case[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [doctors, setDoctors] = useState<{ id: string; full_name: string }[]>([]);

  const [form, setForm] = useState({ title: "", patient_name: "", patient_cpf: "", process_number: "", description: "", priority: "normal", deadline: "" });
  const [requestForm, setRequestForm] = useState({ medico_id: "", type: "prova_tecnica", deadline: "", description: "" });
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [currentRequestStatus, setCurrentRequestStatus] = useState<string | null>(null);
  const [cancelRequestedBy, setCancelRequestedBy] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("timeline");
  const [docFiles, setDocFiles] = useState<Record<string, File | null>>({
    identificacao: null,
    endereco: null,
    laudos: null,
    exames: null,
    receitas: null,
  });

  const fetchCaseHistory = async (caseId: string) => {
    setIsTimelineOpen(true);
    setTimeline([]);

    try {
      const [
        { data: caseData },
        { data: requests },
        { data: consultations },
        { data: docs }
      ] = await Promise.all([
        supabase.from("cases").select("*").eq("id", caseId).single(),
        supabase.from("case_requests").select("*").eq("case_id", caseId),
        supabase.from("consultations").select("*, case_requests!inner(case_id)").eq("case_requests.case_id", caseId),
        supabase.from("documents").select("*").eq("case_id", caseId)
      ]);

      const events: TimelineEvent[] = [];

      if (caseData) {
        events.push({
          id: `creation-${caseData.id}`,
          type: 'creation',
          title: 'Caso Criado',
          description: `O advogado iniciou o caso "${caseData.title}"`,
          date: caseData.created_at,
          icon: FolderOpen
        });
      }

      requests?.forEach(req => {
        events.push({
          id: `req-${req.id}`,
          type: 'request',
          title: 'Solicitação de Perícia',
          description: `Solicitada prova técnica do tipo "${req.type.replace(/_/g, ' ')}"`,
          date: req.created_at,
          icon: Stethoscope
        });
      });

      consultations?.forEach(con => {
        events.push({
          id: `con-${con.id}`,
          type: 'acceptance',
          title: 'Solicitação Aceita',
          description: `O médico aceitou o caso. Status: ${con.status}`,
          date: con.created_at,
          icon: CheckCircle2
        });
      });

      docs?.forEach(doc => {
        events.push({
          id: `doc-${doc.id}`,
          type: 'document',
          title: 'Documento Anexado',
          description: `Arquivo "${doc.file_name}" enviado (${doc.description || 'Geral'})`,
          date: doc.created_at,
          icon: FileText
        });
      });

      setTimeline(events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      fetchMessages(caseId);
    } catch (err) {
      toast.error("Erro ao carregar histórico");
    }
  };

  const fetchMessages = async (caseId: string) => {
    const { data, error } = await supabase
      .from("case_messages")
      .select(`
        *,
        profiles:sender_id (
          full_name
        )
      `)
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao buscar mensagens:", error);
      return;
    }

    const formattedMessages = data.map((m: any) => ({
      ...m,
      sender_name: m.profiles?.full_name || "Usuário"
    }));

    setMessages(formattedMessages);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedCase || !user) return;

    const { error } = await supabase.from("case_messages").insert({
      case_id: selectedCase.id,
      sender_id: user.id,
      content: newMessage.trim()
    });

    if (error) {
      toast.error("Erro ao enviar mensagem: " + error.message);
      console.error("Chat Send Error:", error);
    } else {
      setNewMessage("");
      if (selectedCase?.id) fetchMessages(selectedCase.id);
    }
  };

  useEffect(() => {
    if (!selectedCase || !isTimelineOpen) return;

    const channel = supabase
      .channel(`case-chat-${selectedCase.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "case_messages", filter: `case_id=eq.${selectedCase.id}` },
        () => fetchMessages(selectedCase.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCase, isTimelineOpen]);

  const handleRequestAdjustment = async () => {
    if (!editingRequestId || !selectedCase) return;

    try {
      const { data: reqData } = await supabase
        .from("case_requests")
        .select("medico_id")
        .eq("id", editingRequestId)
        .single();

      const { error } = await supabase
        .from("case_requests")
        .update({ status: "solicitando_ajuste" })
        .eq("id", editingRequestId);

      if (error) throw error;

      if (reqData?.medico_id) {
        await supabase.rpc("notify_user_fn", {
          p_user_id: reqData.medico_id,
          p_title: "Solicitação de Alteração",
          p_message: `O advogado solicitou alterações na prova técnica do caso "${selectedCase?.title}". Acesse Solicitações para revisar.`,
          p_type: "warning",
          p_link: "/solicitacoes",
        });
      }

      toast.success("Solicitação de alteração enviada ao médico!");
      setCurrentRequestStatus("solicitando_ajuste");
      fetchCases();
    } catch (error: any) {
      toast.error("Erro ao solicitar alteração: " + error.message);
    }
  };

  const isLocked = currentRequestStatus !== null &&
    currentRequestStatus !== "pendente" &&
    currentRequestStatus !== "em_ajuste" &&
    currentRequestStatus !== "solicitando_cancelamento";

  const handleDeleteRequest = async () => {
    if (!editingRequestId || !selectedCase) return;
    if (!confirm("Tem certeza que deseja excluir esta solicitação permanentemente?")) return;

    try {
      const { error } = await supabase.from("case_requests").delete().eq("id", editingRequestId);
      if (error) throw error;
      toast.success("Solicitação excluída com sucesso!");
      setRequestDialogOpen(false);
      fetchCases();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const handleCancelRequest = async (confirmAction: boolean = false) => {
    if (!editingRequestId || !selectedCase) return;

    try {
      if (confirmAction) {
        const { error } = await supabase.from("case_requests").delete().eq("id", editingRequestId);
        if (error) throw error;
        toast.success("Solicitação cancelada e removida com sucesso!");

        if (requestForm.medico_id) {
          await supabase.rpc("notify_user_fn", {
            p_user_id: requestForm.medico_id,
            p_title: "Cancelamento Confirmado",
            p_message: `O advogado aceitou o cancelamento da solicitação do caso "${selectedCase.title}".`,
            p_type: "info",
          });
        }
      } else {
        const { error } = await supabase
          .from("case_requests")
          .update({
            status: "solicitando_cancelamento",
            cancel_requested_by: user!.id
          })
          .eq("id", editingRequestId);
        if (error) throw error;

        toast.success("Pedido de cancelamento enviado! Aguardando confirmação do médico.");

        if (requestForm.medico_id) {
          await supabase.rpc("notify_user_fn", {
            p_user_id: requestForm.medico_id,
            p_title: "Pedido de Cancelamento",
            p_message: `O advogado solicitou o cancelamento da prova técnica do caso "${selectedCase.title}". Acesse Solicitações para confirmar.`,
            p_type: "warning",
            p_link: "/solicitacoes",
          });
        }
      }

      setRequestDialogOpen(false);
      fetchCases();
    } catch (error: any) {
      toast.error("Erro no cancelamento: " + error.message);
    }
  };

  const docCategories = [
    { id: "identificacao", label: "Documento de Identificação (com CPF)", required: true },
    { id: "endereco", label: "Comprovante de Endereço", required: true },
    { id: "laudos", label: "Laudos/Atestados Anteriores", required: false },
    { id: "exames", label: "Exames Prévios", required: false },
    { id: "receitas", label: "Receitas Prévias", required: false },
  ];

  const canSubmit = requestForm.medico_id &&
    requestForm.deadline &&
    docFiles.identificacao &&
    docFiles.endereco;

  const fetchCases = async () => {
    if (!user) return;
    const { data } = await supabase.from("cases").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setCases(data as Case[]);
  };

  const fetchDoctors = async () => {
    try {
      const { data: roleRecords } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "medico_generalista");

      if (!roleRecords || roleRecords.length === 0) {
        setDoctors([]);
        return;
      }

      const { data: profileRecords } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", roleRecords.map(r => r.user_id));

      if (profileRecords) {
        setDoctors(profileRecords.map(d => ({ id: d.user_id, full_name: d.full_name })));
      }
    } catch (err) {
      console.error("Erro ao buscar médicos:", err);
    }
  };

  useEffect(() => {
    fetchCases();
    fetchDoctors();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("cases").insert({
      user_id: user.id,
      title: form.title,
      patient_name: form.patient_name,
      patient_cpf: form.patient_cpf || null,
      process_number: form.process_number || null,
      description: form.description || null,
      priority: form.priority,
      deadline: form.deadline || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Caso criado com sucesso!");
    setDialogOpen(false);
    setForm({ title: "", patient_name: "", patient_cpf: "", process_number: "", description: "", priority: "normal", deadline: "" });
    fetchCases();
  };

  const handleOpenEditRequest = async (c: Case) => {
    setSelectedCase(c);
    setEditingRequestId(null);
    setCurrentRequestStatus(null);
    setCancelRequestedBy(null);
    setRequestForm({ medico_id: "", type: "prova_tecnica", deadline: "", description: "" });
    setDocFiles({ identificacao: null, endereco: null, laudos: null, exames: null, receitas: null });

    const { data: request } = await supabase
      .from("case_requests")
      .select("*")
      .eq("case_id", c.id)
      .maybeSingle();

    if (request) {
      setEditingRequestId(request.id);
      setCurrentRequestStatus(request.status);
      setCancelRequestedBy(request.cancel_requested_by);
      setRequestForm({
        medico_id: request.medico_id || "",
        type: request.type,
        deadline: request.deadline ? request.deadline.slice(0, 16) : "",
        description: request.description || "",
      });
    }

    setRequestDialogOpen(true);
  };

  const createRequestMutation = useMutation({
    mutationFn: async (data: typeof requestForm & { case_id: string }) => {
      let request;

      if (editingRequestId) {
        const { data: updated, error: updateError } = await supabase
          .from("case_requests")
          .update({
            medico_id: data.medico_id,
            type: data.type,
            deadline: data.deadline,
            description: data.description,
          })
          .eq("id", editingRequestId)
          .select()
          .single();

        if (updateError) throw updateError;
        request = updated;
      } else {
        const { data: created, error: reqError } = await supabase.from("case_requests").insert({
          case_id: data.case_id,
          advogado_id: user!.id,
          medico_id: data.medico_id,
          type: data.type,
          status: "pendente",
          deadline: data.deadline,
          description: data.description,
        }).select().single();

        if (reqError) throw reqError;
        request = created;
      }

      for (const [category, file] of Object.entries(docFiles)) {
        if (!file) continue;
        const fileExt = file.name.split('.').pop();
        const fileName = `${data.case_id}/${category}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `documents/${fileName}`;

        const { error: uploadError } = await supabase.storage.from("case-documents").upload(filePath, file);
        if (uploadError) continue;

        await supabase.from("documents").insert({
          case_id: data.case_id,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          description: category,
          uploaded_by: user!.id
        });
      }

      if (!editingRequestId) {
        await supabase.rpc("notify_user_fn", {
          p_user_id: data.medico_id,
          p_title: "Nova Solicitação",
          p_message: `O advogado solicitou uma nova prova técnica para o caso "${selectedCase?.title}".`,
          p_type: "info",
          p_link: "/solicitacoes",
        });
      }

      return request;
    },
    onSuccess: () => {
      toast.success(editingRequestId ? "Solicitação atualizada!" : "Solicitação enviada!");
      setRequestDialogOpen(false);
      fetchCases();
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar solicitação: " + error.message);
    }
  });

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    if (requestForm.deadline) {
      const deadlineDate = new Date(requestForm.deadline);
      const now = startOfMinute(new Date());
      if (isBefore(deadlineDate, now)) {
        toast.error("O prazo não pode ser uma data retroativa");
        return;
      }
    }
    createRequestMutation.mutate({ ...requestForm, case_id: selectedCase.id });
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
            <form onSubmit={handleCreate} className="space-y-4">
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
              <Button type="submit" className="w-full min-h-[44px]">Criar Caso</Button>
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
                    <Badge variant="secondary" className={statusColors[c.status] || ""}>
                      {c.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={priorityColors[c.priority] || ""}>
                      {c.priority}
                    </Badge>
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
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedCase(c); fetchCaseHistory(c.id); }}>
                      <History className="mr-2 h-4 w-4" />Histórico / Chat
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

      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRequestId ? "Ver/Editar Solicitação" : "Solicitar Prova Técnica"}</DialogTitle>
            <DialogDescription>
              {isLocked
                ? "Esta solicitação está bloqueada para edição ou em processo de cancelamento."
                : "Selecione um médico e defina o prazo para a perícia médica deste caso."}
            </DialogDescription>
          </DialogHeader>
          <form key={requestDialogOpen ? `${selectedCase?.id}-open` : "closed"} onSubmit={handleCreateRequest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="medico-select" className="flex items-center">
                Médico Generalista {isLocked && <Lock className="ml-2 h-3 w-3 text-muted-foreground" />}
              </Label>
              <Select value={requestForm.medico_id} onValueChange={(v) => setRequestForm({ ...requestForm, medico_id: v })} disabled={isLocked}>
                <SelectTrigger id="medico-select"><SelectValue placeholder="Selecione um médico..." /></SelectTrigger>
                <SelectContent>
                  {doctors.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>{doc.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pericia-type" className="flex items-center">
                Tipo de Perícia {isLocked && <Lock className="ml-2 h-3 w-3 text-muted-foreground" />}
              </Label>
              <Input id="pericia-type" value={requestForm.type} onChange={(e) => setRequestForm({ ...requestForm, type: e.target.value })} required placeholder="Ex: Prova Técnica Previdenciária" disabled={isLocked} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prazo-esperado" className="flex items-center">
                Prazo Esperado {isLocked && <Lock className="ml-2 h-3 w-3 text-muted-foreground" />}
              </Label>
              <Input id="prazo-esperado" type="datetime-local" value={requestForm.deadline} onChange={(e) => setRequestForm({ ...requestForm, deadline: e.target.value })} required disabled={isLocked} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes" className="flex items-center">
                Observações {isLocked && <Lock className="ml-2 h-3 w-3 text-muted-foreground" />}
              </Label>
              <Textarea id="observacoes" value={requestForm.description} onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })} placeholder="Detalhes adicionais para o médico..." rows={3} disabled={isLocked} />
            </div>

            {!editingRequestId && (
              <div className="space-y-4 border-t pt-4">
                <Label className="text-base font-semibold">Anexos Obrigatórios e Opcionais</Label>
                <div className="grid gap-4 max-h-[300px] overflow-y-auto pr-2">
                  {docCategories.map((cat) => (
                    <div key={cat.id} className="space-y-1.5 opacity-80">
                      <Label className="text-xs">{cat.label} {cat.required && "*"}</Label>
                      <Input
                        type="file"
                        onChange={(e) => setDocFiles({ ...docFiles, [cat.id]: e.target.files?.[0] || null })}
                        required={cat.required}
                        className="text-xs h-8"
                      />
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
                        <Clock className="mr-2 h-4 w-4" /> Aguardando Confirmação Médico
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
      <Sheet open={isTimelineOpen} onOpenChange={setIsTimelineOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <SheetHeader className="p-6 pb-0">
              <SheetTitle>Gestão do Caso</SheetTitle>
              <SheetDescription>Acompanhe eventos e converse com a equipe.</SheetDescription>
              <TabsList className="grid w-full grid-cols-2 mt-4">
                <TabsTrigger value="timeline" className="flex items-center gap-2">
                  <History className="h-4 w-4" /> Histórico
                </TabsTrigger>
                <TabsTrigger value="chat" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Mensagens
                </TabsTrigger>
              </TabsList>
            </SheetHeader>

            <TabsContent value="timeline" className="flex-1 overflow-y-auto p-6 mt-0">
              <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                {timeline.length === 0 ? (
                  <p className="text-center text-muted-foreground py-10">Nenhum histórico disponível.</p>
                ) : timeline.map((event) => (
                  <div key={event.id} className="relative flex items-start group">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border bg-background shadow-sm shrink-0 z-10">
                      <event.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="ml-4 space-y-1 pt-1">
                      <div className="flex items-center justify-between gap-4">
                        <h4 className="font-semibold text-sm leading-none">{event.title}</h4>
                        <time className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(event.date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </time>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="chat" className="flex-1 flex flex-col h-full overflow-hidden mt-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2">
                    <MessageSquare className="h-10 w-10 opacity-20" />
                    <p>Inicie uma conversa técnica sobre este caso.</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex flex-col ${m.sender_id === user?.id ? "items-end" : "items-start"}`}>
                      <div className={`max-w-[80%] rounded-lg p-3 text-sm ${m.sender_id === user?.id
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-muted text-foreground rounded-bl-none"
                        }`}>
                        <p className="font-bold text-[10px] mb-1 opacity-80 uppercase">{m.sender_name}</p>
                        {m.content}
                      </div>
                      <time className="text-[10px] text-muted-foreground mt-1 px-1">
                        {format(new Date(m.created_at), "HH:mm")}
                      </time>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t bg-background">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    placeholder="Escreva para o médico..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
