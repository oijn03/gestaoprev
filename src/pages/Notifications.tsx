import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link: string | null;
  created_at: string;
}

export default function Notifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-2 text-muted-foreground">Carregando notificações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificações</h1>
          <p className="text-muted-foreground">Centro de notificações</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead} className="min-h-[44px]">
          <CheckCheck className="mr-2 h-4 w-4" /> Marcar todas como lidas
        </Button>
      </div>

      <div className="space-y-3">
        {!notifications || notifications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="mb-2 h-8 w-8" />
              Nenhuma notificação
            </CardContent>
          </Card>
        ) : notifications.map((n) => (
          <Card key={n.id} className={n.read ? "opacity-60" : "border-l-4 border-l-primary"}>
            <CardContent className="flex items-start justify-between p-4">
              <div className="flex-1">
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              {!n.read && (
                <Button variant="ghost" size="icon" onClick={() => markAsRead(n.id)}>
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
