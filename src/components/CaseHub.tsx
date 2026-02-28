import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    Info, FileText, ClipboardList, History, MessageSquare,
    Send, Download, CheckCircle, FileUp, Loader2, Clock, Calendar
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CaseRequest, Document, TimelineEvent, CaseMessage, Report } from "@/types/case-hub";

interface CaseHubProps {
    caseId: string | null;
    caseName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function CaseHub({ caseId, caseName, open, onOpenChange }: CaseHubProps) {
    const { user, role } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("timeline");
    const [newMessage, setNewMessage] = useState("");
    const [isUploadingReport, setIsUploadingReport] = useState(false);

    // Queries automáticas com useQuery
    const { data: caseDetails } = useQuery({
        queryKey: ["case-details", caseId],
        queryFn: async () => {
            if (!caseId) return null;
            const { data, error } = await supabase.from("cases").select("*").eq("id", caseId).single();
            if (error) throw error;
            return data;
        },
        enabled: !!caseId && open
    });

    const { data: requests } = useQuery({
        queryKey: ["case-requests-sub", caseId],
        queryFn: async () => {
            if (!caseId) return [];
            const { data, error } = await supabase.from("case_requests").select("*, cases(*)").eq("case_id", caseId);
            if (error) throw error;
            return data as CaseRequest[];
        },
        enabled: !!caseId && open
    });

    const { data: documents } = useQuery({
        queryKey: ["case-documents", caseId],
        queryFn: async () => {
            if (!caseId) return [];
            const { data, error } = await supabase.from("documents").select("*").eq("case_id", caseId);
            if (error) throw error;
            return data as Document[];
        },
        enabled: !!caseId && open
    });

    const { data: messages } = useQuery({
        queryKey: ["case-messages", caseId],
        queryFn: async () => {
            if (!caseId) return [];
            const { data, error } = await supabase
                .from("case_messages")
                .select(`*, profiles:sender_id (full_name)`)
                .eq("case_id", caseId)
                .order("created_at", { ascending: true });
            if (error) throw error;
            return data.map((m: any) => ({
                ...m,
                sender_name: m.profiles?.full_name || "Usuário"
            })) as CaseMessage[];
        },
        enabled: !!caseId && open
    });

    const { data: reports } = useQuery({
        queryKey: ["case-reports", caseId],
        queryFn: async () => {
            if (!caseId || !requests?.length) return [];
            const { data, error } = await supabase.from("reports").select("*").eq("case_request_id", requests[0].id);
            if (error) throw error;
            return data as Report[];
        },
        enabled: !!caseId && !!requests?.length && open
    });

    // Realtime para mensagens
    useEffect(() => {
        if (!caseId || !open) return;
        const channel = supabase
            .channel(`chat-${caseId}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "case_messages", filter: `case_id=eq.${caseId}` },
                () => queryClient.invalidateQueries({ queryKey: ["case-messages", caseId] })
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [caseId, open, queryClient]);

    // Lógica de Timeline consolidada
    const timeline: TimelineEvent[] = [];
    if (caseDetails) {
        timeline.push({ id: `case-${caseDetails.id}`, type: 'creation', title: "Caso Criado", description: `O caso "${caseDetails.title}" foi aberto.`, date: caseDetails.created_at, icon: ClipboardList });
    }
    requests?.forEach(r => {
        timeline.push({ id: `req-${r.id}`, type: 'request', title: "Solicitação Enviada", description: `Tipo: ${r.type.replace(/_/g, " ")}. Status: ${r.status}`, date: r.created_at, icon: Clock });
    });
    documents?.forEach(d => {
        timeline.push({ id: `doc-${d.id}`, type: 'document', title: "Documento Anexado", description: d.file_name, date: d.created_at, icon: FileText });
    });
    reports?.forEach(r => {
        timeline.push({ id: `report-${r.id}`, type: 'report', title: "Laudo Entregue", description: r.title, date: r.created_at, icon: CheckCircle });
    });
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Handlers
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !caseId || !user) return;
        const { error } = await supabase.from("case_messages").insert({ case_id: caseId, sender_id: user.id, content: newMessage.trim() });
        if (error) toast.error("Erro ao enviar: " + error.message);
        else { setNewMessage(""); queryClient.invalidateQueries({ queryKey: ["case-messages", caseId] }); }
    };

    const handleDownload = async (path: string) => {
        try {
            const { data, error } = await supabase.storage.from("case-documents").createSignedUrl(path, 3600);
            if (error) throw error;
            window.open(data.signedUrl, '_blank');
        } catch (err: any) { toast.error("Erro ao abrir: " + err.message); }
    };

    const handleDownloadReport = async (path: string) => {
        try {
            const { data, error } = await supabase.storage.from("reports").createSignedUrl(path, 3600);
            if (error) throw error;
            window.open(data.signedUrl, '_blank');
        } catch (err: any) { toast.error("Erro ao abrir: " + err.message); }
    };

    const handleUploadReport = async (file: File) => {
        if (!caseId || !user || !requests?.length) return;
        setIsUploadingReport(true);
        try {
            const fileName = `${Date.now()}_${file.name}`;
            const filePath = `${caseId}/${fileName}`;
            const { error: uploadError } = await supabase.storage.from("reports").upload(filePath, file);
            if (uploadError) throw uploadError;
            const { error: dbError } = await supabase.from("reports").insert({
                case_request_id: requests[0].id,
                author_id: user.id,
                title: `Laudo - ${caseName}`,
                type: "laudo_final",
                status: "concluido",
                file_path: filePath
            });
            if (dbError) throw dbError;
            await supabase.from("case_requests").update({ status: "concluida" }).eq("id", requests[0].id);
            toast.success("Laudo entregue!");
            queryClient.invalidateQueries({ queryKey: ["case-reports", caseId] });
            queryClient.invalidateQueries({ queryKey: ["case-requests-sub", caseId] });
            queryClient.invalidateQueries({ queryKey: ["case-requests"] }); // Para atualizar a lista principal
        } catch (err: any) { toast.error("Erro no upload: " + err.message); }
        finally { setIsUploadingReport(false); }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-xl p-0 flex flex-col">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                    <SheetHeader className="p-6 pb-2 border-b">
                        <SheetTitle className="text-xl flex items-center gap-2"><Info className="h-5 w-5 text-primary" /> Hub do Caso</SheetTitle>
                        <SheetDescription className="font-medium text-foreground italic">Paciente: {caseName}</SheetDescription>
                        <TabsList className="grid w-full grid-cols-5 mt-6">
                            <TabsTrigger value="summary" className="gap-2"><Info className="h-3 w-3" /> Resumo</TabsTrigger>
                            <TabsTrigger value="documents" className="gap-2"><FileText className="h-3 w-3" /> Docs</TabsTrigger>
                            <TabsTrigger value="report" className="gap-2"><ClipboardList className="h-3 w-3" /> Laudo</TabsTrigger>
                            <TabsTrigger value="timeline" className="gap-2"><History className="h-3 w-3" /> Histórico</TabsTrigger>
                            <TabsTrigger value="chat" className="gap-2"><MessageSquare className="h-3 w-3" /> Chat</TabsTrigger>
                        </TabsList>
                    </SheetHeader>

                    <TabsContent value="summary" className="flex-1 overflow-y-auto p-6 space-y-6 m-0">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1 p-3 rounded-lg bg-muted/50 border">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">CPF do Paciente</p>
                                <p className="font-semibold">{caseDetails?.patient_cpf || "Não informado"}</p>
                            </div>
                            <div className="space-y-1 p-3 rounded-lg bg-muted/50 border">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Número do Processo</p>
                                <p className="font-semibold">{caseDetails?.process_number || "Não informado"}</p>
                            </div>
                            {requests?.[0]?.report_forecast_date && (
                                <div className="space-y-1 p-3 rounded-lg bg-primary/5 border border-primary/20 col-span-2">
                                    <p className="text-[10px] uppercase font-bold text-primary">Previsão de Entrega do Laudo</p>
                                    <p className="font-bold text-lg text-primary flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        {format(new Date(requests[0].report_forecast_date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-sm font-bold flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Resumo da Demanda</h4>
                            <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/10 text-sm leading-relaxed text-foreground/80 italic">
                                "{requests?.[0]?.description || "Sem descrição detalhada."}"
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-sm font-bold">Tipo de Prova</h4>
                            <Badge variant="outline" className="capitalize text-lg py-1 px-4">{requests?.[0]?.type.replace(/_/g, " ")}</Badge>
                        </div>
                    </TabsContent>

                    <TabsContent value="documents" className="flex-1 overflow-y-auto p-6 m-0">
                        <div className="space-y-3">
                            {documents?.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-10 opacity-50"><FileText className="h-10 w-10 mb-2" /><p>Sem documentos.</p></div>
                            ) : documents?.map(doc => (
                                <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded bg-primary/10 text-primary"><FileText className="h-4 w-4" /></div>
                                        <div><p className="text-sm font-medium line-clamp-1">{doc.file_name}</p><p className="text-[10px] opacity-70">{doc.description || "Geral"}</p></div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => handleDownload(doc.file_path)}><Download className="h-4 w-4" /></Button>
                                </div>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="report" className="flex-1 overflow-y-auto p-6 m-0">
                        {reports && reports.length > 0 ? (
                            <div className="p-4 rounded-lg bg-success/10 border border-success/20 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <CheckCircle className="h-5 w-5 text-success" />
                                    <div><p className="font-bold text-sm">Laudo Entregue</p><p className="text-xs opacity-70">{format(new Date(reports[0].created_at), "dd/MM/yyyy")}</p></div>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => reports[0].file_path && handleDownloadReport(reports[0].file_path)}>Ver Laudo</Button>
                            </div>
                        ) : role === "medico_generalista" ? (
                            <div className="flex flex-col items-center justify-center p-10 text-center space-y-4">
                                <div className="p-4 rounded-full bg-primary/10 text-primary"><FileUp className="h-10 w-10" /></div>
                                <div><p className="font-bold">Finalizar Caso</p><p className="text-sm opacity-70">Envie o laudo técnico final para concluir a demanda.</p></div>
                                <input type="file" className="hidden" id="report-hub-up" onChange={(e) => e.target.files?.[0] && handleUploadReport(e.target.files[0])} />
                                <Button asChild disabled={isUploadingReport}><label htmlFor="report-hub-up" className="cursor-pointer">
                                    {isUploadingReport ? <Loader2 className="animate-spin mr-2" /> : <FileUp className="mr-2 h-4 w-4" />} Selecionar e Enviar Laudo
                                </label></Button>
                            </div>
                        ) : <div className="flex flex-col items-center justify-center p-10 opacity-50"><Clock className="h-10 w-10 mb-2" /><p>Aguardando laudo médico.</p></div>}
                    </TabsContent>

                    <TabsContent value="timeline" className="flex-1 overflow-y-auto p-6 m-0">
                        <div className="relative space-y-6 before:absolute before:inset-0 before:ml-2 before:-translate-x-px before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                            {timeline.map((event) => (
                                <div key={event.id} className="relative flex gap-4 pl-8">
                                    <div className="absolute left-0 bg-background border rounded-full p-1"><event.icon className="h-4 w-4 text-primary" /></div>
                                    <div className="flex-1"><p className="font-semibold text-sm">{event.title}</p><p className="text-xs opacity-70">{event.description}</p><time className="text-[10px] opacity-40">{format(new Date(event.date), "dd/MM HH:mm")}</time></div>
                                </div>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="chat" className="flex-1 flex flex-col h-full overflow-hidden m-0 border-t">
                        <ScrollArea className="flex-1 p-6 space-y-4">
                            {messages?.length === 0 && <p className="text-center text-xs opacity-50 mt-20">Sem mensagens técnicas.</p>}
                            {messages?.map((m) => (
                                <div key={m.id} className={`flex flex-col mb-4 ${m.sender_id === user?.id ? "items-end" : "items-start"}`}>
                                    <div className={`max-w-[85%] rounded-lg p-3 text-sm ${m.sender_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                        <p className="font-bold text-[10px] mb-1 opacity-70 uppercase">{m.sender_name}</p>{m.content}
                                    </div>
                                    <time className="text-[10px] opacity-40 mt-1">{format(new Date(m.created_at), "HH:mm")}</time>
                                </div>
                            ))}
                        </ScrollArea>
                        <div className="p-4 border-t">
                            <form onSubmit={handleSendMessage} className="flex gap-2">
                                <Input placeholder="Escreva aqui..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                                <Button type="submit" size="icon"><Send className="h-4 w-4" /></Button>
                            </form>
                        </div>
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}
