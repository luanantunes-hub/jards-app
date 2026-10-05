import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// A tela de login usa esta resposta para separar "senha errada" de "conta ainda sem senha".
// Só responde true para conta existente sem senha; e-mail inexistente, conta com senha e
// qualquer falha dão a mesma resposta (false), para não revelar quem tem cadastro.
export async function POST(req: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const { email } = await req.json();
    if (typeof email !== "string" || !email.includes("@") || email.length > 254) {
      return NextResponse.json({ semSenha: false }, { headers });
    }
    const { data, error } = await createAdminClient().rpc("fn_conta_sem_senha", { p_email: email });
    return NextResponse.json({ semSenha: !error && data === true }, { headers });
  } catch {
    return NextResponse.json({ semSenha: false }, { headers });
  }
}
