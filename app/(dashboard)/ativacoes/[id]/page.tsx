"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { use, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ActivationPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    void (async () => {
      const delivery = await (supabase as any).from("compromissos_cliente").select("id").eq("plano_ativacao_id", id).order("created_at").limit(1).maybeSingle();
      if (delivery.data?.id) { router.replace(`/entregas/${delivery.data.id}`); return; }
      const plan = await (supabase as any).from("planos_ativacao").select("conta_patrocinio_id").eq("id", id).maybeSingle();
      router.replace(plan.data?.conta_patrocinio_id ? `/contas-patrocinio/${plan.data.conta_patrocinio_id}` : "/contas-patrocinio");
    })();
  }, [id, router, supabase]);

  return <div className="mx-auto max-w-pagina px-4 py-16 text-center text-[0.75rem] text-black/30 sm:px-6 lg:px-10">Abrindo entrega…</div>;
}
