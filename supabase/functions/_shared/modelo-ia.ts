// Modelo do Gemini das funções de IA. O secret GOOGLE_AI_MODEL troca sem novo
// deploy. O Google tirou o 2.5 Flash de contas novas em 2026 (a chamada volta
// 404); o recomendado agora é o 3.8 Flash. Nos modelos 3.x a temperatura fica
// no padrão: abaixo de 1.0 o Google avisa que a resposta pode entrar em laço.
export function modeloDaIa(): string {
  return Deno.env.get("GOOGLE_AI_MODEL") || "gemini-3.8-flash";
}
