import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ClipboardList, CheckCircle, Clock } from "lucide-react";

export function EspecialistaDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ requests: 0, reports: 0, completed: 0, pending: 0 });

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const { count: requests } = await supabase.from("case_requests").select("*", { count: "exact", head: true }).eq("especialista_id", user.id);
      const { count: reports } = await supabase.from("reports").select("*", { count: "exact", head: true }).eq("author_id", user.id);
      const { count: completed } = await supabase.from("reports").select("*", { count: "exact", head: true }).eq("author_id", user.id).eq("status", "finalizado");
      const { count: pending } = await supabase.from("case_requests").select("*", { count: "exact", head: true }).eq("especialista_id", user.id).eq("status", "pendente");

      setStats({
        requests: requests || 0,
        reports: reports || 0,
        completed: completed || 0,
        pending: pending || 0,
      });
    };
    fetchStats();
  }, [user]);

  const cards = [
    { title: "Laudos Solicitados", value: stats.requests, icon: ClipboardList, color: "text-primary" },
    { title: "Laudos Elaborados", value: stats.reports, icon: FileText, color: "text-primary" },
    { title: "Finalizados", value: stats.completed, icon: CheckCircle, color: "text-success" },
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
