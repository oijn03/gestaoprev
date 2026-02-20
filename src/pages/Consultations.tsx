import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays } from "lucide-react";

interface Consultation {
  id: string;
  patient_name: string;
  scheduled_at: string | null;
  status: string;
  notes: string | null;
}

export default function Consultations() {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<Consultation[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase.from("consultations").select("*").eq("medico_id", user.id).order("scheduled_at", { ascending: true });
      if (data) setConsultations(data as Consultation[]);
    };
    fetch();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Consultas</h1>
        <p className="text-muted-foreground">Consultas agendadas</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consultations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    <CalendarDays className="mx-auto mb-2 h-8 w-8" />
                    Nenhuma consulta agendada
                  </TableCell>
                </TableRow>
              ) : consultations.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.patient_name}</TableCell>
                  <TableCell>{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString("pt-BR") : "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
