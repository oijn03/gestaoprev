import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, CalendarDays, FileText, Clock } from "lucide-react";

export function MedicoDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ requests: 0, consultations: 0, reports: 0, pending: 0 });

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const { count: requests } = await supabase.from("case_requests").select("*", { count: "exact", head: true }).eq("medico_id", user.id);
      const { count: consultations } = await supabase.from("consultations").select("*", { count: "exact", head: true }).eq("medico_id", user.id);
      const { count: reports } = await supabase.from("reports").select("*", { count: "exact", head: true }).eq("author_id", user.id);
      const { count: pending } = await supabase.from("case_requests").select("*", { count: "exact", head: true }).eq("medico_id", user.id).eq("status", "pendente");

      setStats({
        requests: requests || 0,
        consultations: consultations || 0,
        reports: reports || 0,
        pending: pending || 0,
      });
    };

    fetchStats();

    // Realtime subscription
    const channel = supabase
      .channel("medico-stats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_requests", filter: `medico_id=eq.${user.id}` },
        () => fetchStats()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "consultations", filter: `medico_id=eq.${user.id}` },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const cards = [
    { title: "Solicitações Recebidas", value: stats.requests, icon: ClipboardList, color: "text-primary" },
    { title: "Consultas Agendadas", value: stats.consultations, icon: CalendarDays, color: "text-success" },
    { title: "Laudos/Pré-laudos", value: stats.reports, icon: FileText, color: "text-primary" },
    { title: "Pendentes", value: stats.pending, icon: Clock, color: "text-warning" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <card.icon className={`h-5 w-5 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
