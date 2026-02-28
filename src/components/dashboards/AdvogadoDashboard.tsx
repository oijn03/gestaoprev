import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, ClipboardList, AlertTriangle, Clock, Loader2, PieChart as PieChartIcon, BarChart3 } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export function AdvogadoDashboard() {
  const { user } = useAuth();

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["advogado-dashboard-data", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const [casesRes, requestsRes] = await Promise.all([
        supabase.from("cases").select("*").eq("user_id", user.id),
        supabase.from("case_requests").select("*").eq("advogado_id", user.id),
      ]);

      const cases = casesRes.data || [];
      const requests = requestsRes.data || [];

      // Processar dados para o gráfico de pizza (Status dos Casos)
      const statusCounts = cases.reduce((acc: any, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, {});

      const pieData = Object.entries(statusCounts).map(([name, value]) => ({
        name: name.replace(/_/g, " ").toUpperCase(),
        value
      }));

      // Processar dados para o gráfico de barras (Solicitações por Status)
      const reqStatusCounts = requests.reduce((acc: any, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, {});

      const barData = Object.entries(reqStatusCounts).map(([name, value]) => ({
        name: name.replace(/_/g, " "),
        quantidade: value
      }));

      return {
        stats: {
          cases: cases.length,
          requests: requests.length,
          urgent: cases.filter(c => c.priority === "urgente").length,
          pending: requests.filter(r => r.status === "pendente").length,
        },
        pieData,
        barData
      };
    },
    enabled: !!user,
  });

  const cards = [
    { title: "Total de Casos", value: dashboardData?.stats.cases ?? 0, icon: FolderOpen, color: "text-primary" },
    { title: "Solicitações", value: dashboardData?.stats.requests ?? 0, icon: ClipboardList, color: "text-primary" },
    { title: "Casos Urgentes", value: dashboardData?.stats.urgent ?? 0, icon: AlertTriangle, color: "text-destructive" },
    { title: "Pendentes", value: dashboardData?.stats.pending ?? 0, icon: Clock, color: "text-warning" },
  ];

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando painel analítico...</span>
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
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-primary" />
              Distribuição por Status
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {dashboardData?.pieData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboardData.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {dashboardData.pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Sem dados de casos para exibir
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Solicitações por Estado
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {dashboardData?.barData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.barData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="quantidade" fill="#8884d8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Sem dados de solicitações para exibir
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
