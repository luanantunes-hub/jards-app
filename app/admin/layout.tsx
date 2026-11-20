import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "./AdminNav";
import { DeleteConfirmProvider } from "@/contexts/DeleteConfirmContext";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("jards_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  // Quem não é superadmin não pode nem ver que este workspace existe:
  // abrir /admin pelo link devolve erro 404 (não redireciona para o app).
  if (profile?.jards_super_admin !== true) notFound();

  return (
    <div className="min-h-screen" style={{ background: "#FAFAFA" }}>
      <AdminNav />
      {/* Confirmações do admin (ex.: encerrar cortesia) usam o diálogo global. */}
      <DeleteConfirmProvider>
        <main>{children}</main>
      </DeleteConfirmProvider>
    </div>
  );
}
