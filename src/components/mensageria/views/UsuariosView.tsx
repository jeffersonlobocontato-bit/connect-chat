import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listUsers, setUserRole, inviteUser } from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "../ui-bits";

type PlatformUser = { userId: string; email: string; role: string };

export function UsuariosView() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const carregarUsuarios = useServerFn(listUsers);
  const alterarPapel = useServerFn(setUserRole);
  const convidar = useServerFn(inviteUser);

  async function carregar() {
    setLoading(true);
    try {
      setUsers(await carregarUsuarios({}));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviarConvite() {
    if (!email.trim()) {
      toast.error("Informe o e-mail do convidado");
      return;
    }
    try {
      await convidar({ data: { email: email.trim() } });
      setEmail("");
      toast.success("Convite enviado como Agente");
      void carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao convidar");
    }
  }

  async function mudarPapel(userId: string, role: "admin" | "user") {
    try {
      await alterarPapel({ data: { userId, role } });
      toast.success("Papel atualizado");
      void carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar papel");
    }
  }

  return (
    <div>
      <PageHeader
        title="Usuários"
        subtitle="Administrador vê tudo. Agente acessa apenas Dashboard e Conversas."
      />

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <Label>Convidar por e-mail</Label>
        <div className="mt-2 flex gap-2">
          <Input
            type="email"
            value={email}
            placeholder="pessoa@empresa.com.br"
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button onClick={enviarConvite}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Convidar
          </Button>
        </div>
      </section>

      {loading ? (
        <EmptyState message="Carregando usuários..." />
      ) : users.length === 0 ? (
        <EmptyState message="Nenhum usuário cadastrado." />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {users.map((u) => (
            <div key={u.userId} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="truncate text-sm">{u.email}</span>
              <Select
                value={u.role === "admin" ? "admin" : "user"}
                onValueChange={(v) => void mudarPapel(u.userId, v as "admin" | "user")}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="user">Agente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
