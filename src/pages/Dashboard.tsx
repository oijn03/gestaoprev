import { useAuth } from "@/contexts/AuthContext";
import { AdvogadoDashboard } from "@/components/dashboards/AdvogadoDashboard";
import { MedicoDashboard } from "@/components/dashboards/MedicoDashboard";
import { EspecialistaDashboard } from "@/components/dashboards/EspecialistaDashboard";

export default function Dashboard() {
  const { role, profile, loading } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Olá, {profile?.full_name || "Usuário"}
        </h1>
        <p className="text-muted-foreground">Bem-vindo ao seu painel de controle.</p>
      </div>

      {role === "advogado" && <AdvogadoDashboard />}
      {role === "medico_generalista" && <MedicoDashboard />}
      {role === "especialista" && <EspecialistaDashboard />}
      {!role && !loading && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="font-semibold text-destructive">Perfil Incompleto</p>
          <p className="text-sm text-muted-foreground">
            Não foi possível identificar seu nível de acesso. Por favor, contate o administrador ou tente sair e entrar novamente.
          </p>
        </div>
      )}
      {!role && loading && (
        <p className="text-muted-foreground">Carregando informações do perfil...</p>
      )}
    </div>
  );
}
