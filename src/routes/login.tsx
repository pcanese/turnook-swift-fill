import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "TurnoOk — Iniciar sesión" },
      { name: "description", content: "Iniciar sesión en TurnoOk" },
    ],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Completá email y contraseña.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message === "Invalid login credentials" ? "Email o contraseña incorrectos." : error.message);
      } else {
        toast.success("Sesión iniciada.");
        navigate({ to: "/", search: { fecha: new Date().toISOString().split("T")[0] } });
      }
    } catch {
      toast.error("Ocurrió un error. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-2xl font-medium text-foreground">
            turno<span className="text-teal">ok</span>
          </span>
          <p className="mt-2 text-sm text-muted-foreground">Iniciá sesión para acceder al sistema</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div>
            <label className="text-xs font-medium text-foreground">Email</label>
            <Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="doctor@consultorio.com" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Contraseña</label>
            <Input className="mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Demo: usá cualquier email registrado en el sistema
        </p>
      </div>
    </div>
  );
}
