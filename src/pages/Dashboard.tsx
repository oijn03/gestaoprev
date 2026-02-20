import { useAuth } from "@/contexts/AuthContext";
import { AdvogadoDashboard } from "@/components/dashboards/AdvogadoDashboard";
import { MedicoDashboard } from "@/components/dashboards/MedicoDashboard";
import { EspecialistaDashboard } from "@/components/dashboards/EspecialistaDashboard";

export default function Dashboard() {
  const { role, profile } = useAuth();

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
      {!role && (
        <p className="text-muted-foreground">Carregando informações do perfil...</p>
      )}
    </div>
  );
}
