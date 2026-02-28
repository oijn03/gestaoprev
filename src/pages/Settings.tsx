import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  const { profile, user, refreshProfile } = useAuth();
  // Bug #5 fix: initialise with empty strings; sync via useEffect
  // when profile loads asynchronously after mount
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);


  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, phone: phone || null }).eq("user_id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await refreshProfile();
    toast.success("Perfil atualizado!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Gerencie seu perfil</p>
        </div>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Dados do Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled />
            </div>
            <Button type="submit" className="min-h-[44px]" disabled={saving}>
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
