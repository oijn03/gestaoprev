import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Shield, Download, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function LgpdPanel() {
  const { user, profile, role, signOut } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExportData = async () => {
    if (!user) return;

    const [profileRes, rolesRes, consentsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id),
      supabase.from("user_roles").select("*").eq("user_id", user.id),
      supabase.from("lgpd_consents").select("*").eq("user_id", user.id),
    ]);

    const report = {
      exportado_em: new Date().toISOString(),
      email: user.email,
      perfil: profileRes.data,
      papeis: rolesRes.data,
      consentimentos: consentsRes.data,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meus-dados-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "export_personal_data",
      resource_type: "lgpd",
      details: {},
    });

    toast.success("Relatório de dados exportado com sucesso");
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "request_data_deletion",
      resource_type: "lgpd",
      details: {},
    });

    // Delete user data (cascades handle most)
    await supabase.from("profiles").delete().eq("user_id", user.id);
    await supabase.from("user_roles").delete().eq("user_id", user.id);
    await supabase.from("lgpd_consents").delete().eq("user_id", user.id);
    await supabase.from("notifications").delete().eq("user_id", user.id);

    toast.success("Seus dados foram marcados para exclusão.");
    setDeleting(false);
    setDeleteOpen(false);
    signOut();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Privacidade e LGPD</h1>
          <p className="text-muted-foreground">Gerencie seus dados pessoais</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Seus Dados</CardTitle>
            <CardDescription>Informações armazenadas no sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Nome:</span> <span>{profile?.full_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email:</span> <span>{user?.email}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tipo:</span> <span className="capitalize">{role?.replace(/_/g, " ")}</span></div>
            {profile?.oab_number && <div className="flex justify-between"><span className="text-muted-foreground">OAB:</span> <span>{profile.oab_number}</span></div>}
            {profile?.crm_number && <div className="flex justify-between"><span className="text-muted-foreground">CRM:</span> <span>{profile.crm_number}</span></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ações LGPD</CardTitle>
            <CardDescription>Seus direitos como titular de dados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full min-h-[44px] justify-start" onClick={handleExportData}>
              <Download className="mr-2 h-4 w-4" /> Exportar Meus Dados
            </Button>

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full min-h-[44px] justify-start">
                  <Trash2 className="mr-2 h-4 w-4" /> Solicitar Exclusão de Dados
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Confirmar Exclusão de Dados
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Esta ação é irreversível. Todos os seus dados pessoais serão excluídos permanentemente
                  do sistema, incluindo perfil, consentimentos e notificações. Casos e documentos vinculados
                  poderão ser afetados.
                </p>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
                  <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting}>
                    {deleting ? "Excluindo..." : "Confirmar Exclusão"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
