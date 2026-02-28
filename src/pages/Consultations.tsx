import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { LayoutList, Calendar as CalendarIcon, ChevronLeft, ChevronRight, MessageSquare, CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths
} from "date-fns";
import { ptBR } from "date-fns/locale";
import CaseHub from "@/components/CaseHub";

export default function Consultations() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [currentDate, setCurrentDate] = useState(new Date());

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCaseName, setSelectedCaseName] = useState("");

  const { data: consultations, isLoading, error } = useQuery({
    queryKey: ["consultations", user?.id, role],
    queryFn: async () => {
      if (!user || !role) return [];
      let query = supabase
        .from("consultations")
        .select("*, case_requests(case_id, id)")
        .order("scheduled_at", { ascending: true });

      if (role === "medico_generalista") {
        query = query.eq("medico_id", user.id);
      } else if (role === "advogado") {
        const { data: reqIds } = await supabase.from("case_requests").select("id").eq("advogado_id", user.id);
        if (!reqIds || reqIds.length === 0) return [];
        query = query.in("case_request_id", reqIds.map((r) => r.id));
      }

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      return data;
    },
    enabled: !!user && !!role,
    staleTime: 1000 * 60 * 5,
  });

  const statusColors: Record<string, string> = {
    agendada: "bg-primary/10 text-primary",
    em_andamento: "bg-warning/10 text-warning",
    concluida: "bg-success/10 text-success",
    cancelada: "bg-destructive/10 text-destructive",
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Consultas</h1>
          <p className="text-muted-foreground">{role === "advogado" ? "Consultas dos seus casos" : "Agenda de consultas"}</p>
        </div>
        <div className="flex bg-muted p-1 rounded-lg">
          <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")}><LayoutList className="h-4 w-4 mr-2" /> Lista</Button>
          <Button variant={viewMode === "calendar" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("calendar")}><CalendarIcon className="h-4 w-4 mr-2" /> Calendário</Button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg capitalize">{format(currentDate, "MMMM yyyy", { locale: ptBR })}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 border-t">
            <div className="grid grid-cols-7 text-center font-semibold text-xs border-b bg-muted/30">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => <div key={day} className="py-2">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 auto-rows-[100px]">
              {calendarDays.map((day, idx) => {
                const dayConsultations = consultations?.filter(c => c.scheduled_at && isSameDay(new Date(c.scheduled_at), day));
                return (
                  <div key={idx} className={`p-1 border-r border-b relative ${!isSameMonth(day, monthStart) ? "opacity-30" : ""}`}>
                    <span className={`text-[10px] font-bold ${isSameDay(day, new Date()) ? "text-primary" : ""}`}>{format(day, "d")}</span>
                    <div className="mt-1 space-y-1 overflow-y-auto max-h-[75px]">
                      {dayConsultations?.map(con => (
                        <div key={con.id} className="text-[9px] p-1 rounded bg-primary/10 border-l-2 border-primary truncate" title={con.patient_name}>
                          {format(new Date(con.scheduled_at!), "HH:mm")} {con.patient_name}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultations?.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10 opacity-50"><CalendarDays className="mx-auto mb-2 h-8 w-8" />Sem consultas</TableCell></TableRow>
                ) : consultations?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.patient_name}</TableCell>
                    <TableCell>{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString("pt-BR") : "—"}</TableCell>
                    <TableCell><Badge variant="secondary" className={statusColors[c.status] || ""}>{c.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => {
                        const cid = (c as any).case_requests?.case_id;
                        if (cid) {
                          setSelectedCaseId(cid);
                          setSelectedCaseName(c.patient_name);
                          setIsHistoryOpen(true);
                        } else toast.error("Caso não vinculado.");
                      }}><MessageSquare className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CaseHub caseId={selectedCaseId} caseName={selectedCaseName} open={isHistoryOpen} onOpenChange={setIsHistoryOpen} />
    </div>
  );
}
