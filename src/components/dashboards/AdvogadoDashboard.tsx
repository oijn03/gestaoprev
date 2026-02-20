import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, ClipboardList, AlertTriangle, Clock } from "lucide-react";

export function AdvogadoDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ cases: 0, requests: 0, urgent: 0, pending: 0 });

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const { count: cases } = await supabase.from("cases").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      const { count: requests } = await supabase.from("case_requests").select("*", { count: "exact", head: true }).eq("advogado_id", user.id);
      const { count: urgent } = await supabase.from("cases").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("priority", "urgente");
      const { count: pending } = await supabase.from("case_requests").select("*", { count: "exact", head: true }).eq("advogado_id", user.id).eq("status", "pendente");

      setStats({
        cases: cases || 0,
        requests: requests || 0,
        urgent: urgent || 0,
        pending: pending || 0,
      });
    };
    fetchStats();
  }, [user]);

  const cards = [
    { title: "Total de Casos", value: stats.cases, icon: FolderOpen, color: "text-primary" },
    { title: "Solicitações", value: stats.requests, icon: ClipboardList, color: "text-primary" },
    { title: "Casos Urgentes", value: stats.urgent, icon: AlertTriangle, color: "text-destructive" },
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
