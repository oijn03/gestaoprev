import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ClipboardList, CheckCircle, Clock, Loader2 } from "lucide-react";

export function EspecialistaDashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["especialista-stats", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const [requestsRes, reportsRes, completedRes, pendingRes] = await Promise.all([
        supabase.from("case_requests").select("*", { count: "exact", head: true }).eq("especialista_id", user.id),
        supabase.from("reports").select("*", { count: "exact", head: true }).eq("author_id", user.id),
        supabase.from("reports").select("*", { count: "exact", head: true }).eq("author_id", user.id).eq("status", "finalizado"),
        supabase.from("case_requests").select("*", { count: "exact", head: true }).eq("especialista_id", user.id).eq("status", "pendente"),
      ]);

      return {
        requests: requestsRes.count || 0,
        reports: reportsRes.count || 0,
        completed: completedRes.count || 0,
        pending: pendingRes.count || 0,
      };
    },
    enabled: !!user,
  });

  const cards = [
    { title: "Laudos Solicitados", value: stats?.requests ?? 0, icon: ClipboardList, color: "text-primary" },
    { title: "Laudos Elaborados", value: stats?.reports ?? 0, icon: FileText, color: "text-primary" },
    { title: "Finalizados", value: stats?.completed ?? 0, icon: CheckCircle, color: "text-success" },
    { title: "Pendentes", value: stats?.pending ?? 0, icon: Clock, color: "text-warning" },
  ];

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando estatísticas...</span>
      </div>
    );
  }

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
