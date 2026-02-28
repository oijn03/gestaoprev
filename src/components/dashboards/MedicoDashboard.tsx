import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, CalendarDays, FileText, Clock, Loader2, BarChart3, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from "recharts";

export function MedicoDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["medico-dashboard-data", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const [requestsRes, consultationsRes, reportsRes] = await Promise.all([
        supabase.from("case_requests").select("*").eq("medico_id", user.id),
        supabase.from("consultations").select("*").eq("medico_id", user.id),
        supabase.from("reports").select("*").eq("author_id", user.id),
      ]);

      const requests = requestsRes.data || [];
      const consultations = consultationsRes.data || [];
      const reports = reportsRes.data || [];

      // Processar dados para o gráfico de barras (Status de Solicitações)
      const reqStatusCounts = requests.reduce((acc: any, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, {});

      const barData = Object.entries(reqStatusCounts).map(([name, value]) => ({
        name: name.replace(/_/g, " "),
        quantidade: value
      }));

      // Processar dados para tendência (Solicitações por data - últimos 7 dias simplificado)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      }).reverse();

      const lineData = last7Days.map(date => ({
        data: date.split('-').slice(1).reverse().join('/'),
        total: requests.filter(r => r.created_at.startsWith(date)).length
      }));

      return {
        stats: {
          requests: requests.length,
          consultations: consultations.length,
          reports: reports.length,
          pending: requests.filter(r => r.status === "pendente").length,
        },
        barData,
        lineData
      };
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("medico-dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_requests", filter: `medico_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["medico-dashboard-data", user.id] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const cards = [
    { title: "Solicitações Recebidas", value: dashboardData?.stats.requests ?? 0, icon: ClipboardList, color: "text-primary" },
    { title: "Consultas Agendadas", value: dashboardData?.stats.consultations ?? 0, icon: CalendarDays, color: "text-success" },
    { title: "Laudos Produzidos", value: dashboardData?.stats.reports ?? 0, icon: FileText, color: "text-primary" },
    { title: "Solicitações Pendentes", value: dashboardData?.stats.pending ?? 0, icon: Clock, color: "text-warning" },
  ];

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando painel do médico...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Solicitações por Status
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {dashboardData?.barData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.barData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} interval={0} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="quantidade" fill="#00C49F" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Sem solicitações para exibir
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Entrada de Demandas (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dashboardData?.lineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="data" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
