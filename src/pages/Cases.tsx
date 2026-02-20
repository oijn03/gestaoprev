import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FolderOpen, AlertTriangle, Clock, Search } from "lucide-react";
import { toast } from "sonner";

interface Case {
  id: string;
  title: string;
  patient_name: string;
  patient_cpf: string | null;
  process_number: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  description: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  aberto: "bg-primary/10 text-primary",
  em_andamento: "bg-warning/10 text-warning",
  aguardando_laudo: "bg-warning/10 text-warning",
  concluido: "bg-success/10 text-success",
  arquivado: "bg-muted text-muted-foreground",
};

const priorityColors: Record<string, string> = {
  normal: "bg-muted text-muted-foreground",
  alta: "bg-warning/10 text-warning",
  urgente: "bg-destructive/10 text-destructive",
};

export default function Cases() {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", patient_name: "", patient_cpf: "", process_number: "", description: "", priority: "normal", deadline: "" });

  const fetchCases = async () => {
    if (!user) return;
    const { data } = await supabase.from("cases").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setCases(data as Case[]);
  };

  useEffect(() => { fetchCases(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("cases").insert({
      user_id: user.id,
      title: form.title,
      patient_name: form.patient_name,
      patient_cpf: form.patient_cpf || null,
      process_number: form.process_number || null,
      description: form.description || null,
      priority: form.priority,
      deadline: form.deadline || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Caso criado com sucesso!");
    setDialogOpen(false);
    setForm({ title: "", patient_name: "", patient_cpf: "", process_number: "", description: "", priority: "normal", deadline: "" });
    fetchCases();
  };

  const filtered = cases.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.patient_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meus Casos</h1>
          <p className="text-muted-foreground">Gerencie seus casos previdenciários</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="min-h-[44px]"><Plus className="mr-2 h-4 w-4" /> Novo Caso</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Criar Novo Caso</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Título do Caso</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Paciente</Label>
                  <Input value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} required maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={form.patient_cpf} onChange={(e) => setForm({ ...form, patient_cpf: e.target.value })} maxLength={14} placeholder="000.000.000-00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nº Processo</Label>
                  <Input value={form.process_number} onChange={(e) => setForm({ ...form, process_number: e.target.value })} maxLength={30} />
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Prazo Fatal</Label>
                <Input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} rows={3} />
              </div>
              <Button type="submit" className="w-full min-h-[44px]">Criar Caso</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por título ou paciente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caso</TableHead>
                <TableHead className="hidden md:table-cell">Paciente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead className="hidden lg:table-cell">Prazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <FolderOpen className="mx-auto mb-2 h-8 w-8" />
                    Nenhum caso encontrado
                  </TableCell>
                </TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground md:hidden">{c.patient_name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{c.patient_name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[c.status] || ""}>
                      {c.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={priorityColors[c.priority] || ""}>
                      {c.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {c.deadline ? (
                      <span className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {new Date(c.deadline).toLocaleDateString("pt-BR")}
                      </span>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
