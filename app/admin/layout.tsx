import { redirect } from "next/navigation";
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

  if (!profile?.jards_super_admin) redirect("/dashboard");

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
