import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Scale, Stethoscope, Microscope, Shield } from "lucide-react";

type AppRole = "advogado" | "medico_generalista" | "especialista";

const roleLabels: Record<AppRole, { label: string; icon: typeof Scale }> = {
  advogado: { label: "Advogado", icon: Scale },
  medico_generalista: { label: "Médico Generalista", icon: Stethoscope },
  especialista: { label: "Especialista", icon: Microscope },
};

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole | "">("");
  const [oabNumber, setOabNumber] = useState("");
  const [crmNumber, setCrmNumber] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/dashboard");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) { toast.error("Selecione o tipo de usuário"); return; }
    if (!lgpdConsent) { toast.error("Aceite os termos LGPD para continuar"); return; }
    if (!fullName.trim()) { toast.error("Informe seu nome completo"); return; }
    if (role === "advogado" && !oabNumber.trim()) { toast.error("Informe o número da OAB"); return; }
    if ((role === "medico_generalista" || role === "especialista") && !crmNumber.trim()) { toast.error("Informe o número do CRM"); return; }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Insert role
      await supabase.from("user_roles").insert({ user_id: data.user.id, role });

      // Update profile with professional data
      await supabase.from("profiles").update({
        full_name: fullName,
        oab_number: role === "advogado" ? oabNumber : null,
        crm_number: role !== "advogado" ? crmNumber : null,
        specialization: role === "especialista" ? specialization : null,
      }).eq("user_id", data.user.id);

      // LGPD consent
      await supabase.from("lgpd_consents").insert({
        user_id: data.user.id,
        consent_type: "termos_uso_e_privacidade",
        accepted: true,
        accepted_at: new Date().toISOString(),
      });
    }

    setLoading(false);
    toast.success("Cadastro realizado! Verifique seu email para confirmar a conta.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Gestão Previdenciária</CardTitle>
          <CardDescription>
            {isLogin ? "Entre na sua conta" : "Crie sua conta profissional"}
          </CardDescription>
        </CardHeader>

        <form onSubmit={isLogin ? handleLogin : handleRegister}>
          <CardContent className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Tipo de Usuário</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(roleLabels) as AppRole[]).map((key) => {
                        const { label, icon: Icon } = roleLabels[key];
                        return (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <Icon className="h-4 w-4" /> {label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {role === "advogado" && (
                  <div className="space-y-2">
                    <Label htmlFor="oab">Número OAB</Label>
                    <Input id="oab" value={oabNumber} onChange={(e) => setOabNumber(e.target.value)} placeholder="Ex: 123456/SP" maxLength={20} />
                  </div>
                )}

                {(role === "medico_generalista" || role === "especialista") && (
                  <div className="space-y-2">
                    <Label htmlFor="crm">Número CRM</Label>
                    <Input id="crm" value={crmNumber} onChange={(e) => setCrmNumber(e.target.value)} placeholder="Ex: 12345/SP" maxLength={20} />
                  </div>
                )}

                {role === "especialista" && (
                  <div className="space-y-2">
                    <Label htmlFor="spec">Especialização</Label>
                    <Input id="spec" value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="Ex: Ortopedia" maxLength={50} />
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={72} />
            </div>

            {!isLogin && (
              <div className="flex items-start gap-2">
                <Checkbox id="lgpd" checked={lgpdConsent} onCheckedChange={(v) => setLgpdConsent(v === true)} />
                <Label htmlFor="lgpd" className="text-sm leading-snug">
                  Li e aceito os{" "}
                  <Link to="/privacidade" className="text-primary underline" target="_blank">
                    Termos de Uso e Política de Privacidade
                  </Link>{" "}
                  em conformidade com a LGPD.
                </Label>
              </div>
            )}

            <Button type="submit" className="w-full min-h-[44px]" disabled={loading}>
              {loading ? "Carregando..." : isLogin ? "Entrar" : "Cadastrar"}
            </Button>
          </CardContent>
        </form>

        <CardFooter className="justify-center">
          <button type="button" className="text-sm text-muted-foreground hover:text-primary" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
