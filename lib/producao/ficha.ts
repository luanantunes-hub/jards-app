// A ficha do espaço e a ficha técnica da sala (plano do módulo, PD3.1): leitura do formulário com as regras do banco e o
// resumo em linhas para mostrar. Sem tela e sem banco.

import { lerNumero } from "@/lib/producao/inventario";

const EMAIL = /^[^@\s]+@[^@\s]+$/;
const texto = (valor: string) => (valor.trim() === "" ? null : valor.trim());

type Numero = number | null | "erro";
function numero(valor: string, minimo: number, maximo: number, inteiro = false): Numero {
  const n = lerNumero(valor);
  if (n === null) return null;
  if (n === "invalido" || n < minimo || n > maximo || (inteiro && !Number.isInteger(n))) return "erro";
  return n;
}

// ─── Espaço ─────────────────────────────────────────────────────────────────

export type FichaDoEspaco = {
  funcionamento: string | null; acessibilidade: string | null; carga_descarga: string | null; doca_altura_m: number | null; veiculo_max_m: number | null;
  contato_nome: string | null; contato_telefone: string | null; contato_email: string | null;
};
export type CamposDoEspaco = { funcionamento: string; acessibilidade: string; cargaDescarga: string; docaAltura: string; veiculoMax: string; contatoNome: string; contatoTelefone: string; contatoEmail: string };
export type LeituraDaFichaDoEspaco = { ok: true; ficha: FichaDoEspaco } | { ok: false; erro: string };

/** A ficha do espaço como o banco aceita: textos até 2.000 letras, doca até 20 m, veículo até 40 m, e-mail com arroba. */
export function lerFichaDoEspaco(c: CamposDoEspaco): LeituraDaFichaDoEspaco {
  for (const [rotulo, valor] of [["Funcionamento", c.funcionamento], ["Acessibilidade", c.acessibilidade], ["Carga e descarga", c.cargaDescarga]] as const) {
    if (valor.length > 2000) return { ok: false, erro: `${rotulo}: até 2.000 letras.` };
  }
  const doca = numero(c.docaAltura, 0, 20), veiculo = numero(c.veiculoMax, 0, 40);
  if (doca === "erro") return { ok: false, erro: "A altura da doca é um número de 0 a 20 metros." };
  if (veiculo === "erro") return { ok: false, erro: "O comprimento máximo do veículo é um número de 0 a 40 metros." };
  const nome = texto(c.contatoNome), telefone = texto(c.contatoTelefone), email = texto(c.contatoEmail);
  if (nome && nome.length > 200) return { ok: false, erro: "O nome do contato pode ter até 200 letras." };
  if (telefone && telefone.length > 40) return { ok: false, erro: "O telefone pode ter até 40 caracteres." };
  if (email && (email.length > 254 || !EMAIL.test(email))) return { ok: false, erro: "Esse e-mail não parece certo." };
  return {
    ok: true,
    ficha: {
      funcionamento: texto(c.funcionamento), acessibilidade: texto(c.acessibilidade), carga_descarga: texto(c.cargaDescarga),
      doca_altura_m: doca, veiculo_max_m: veiculo, contato_nome: nome, contato_telefone: telefone, contato_email: email,
    },
  };
}

// ─── Sala ───────────────────────────────────────────────────────────────────

export type FichaDaSala = {
  palco_boca_m: number | null; palco_profundidade_m: number | null; palco_altura_m: number | null; palco_piso: string | null;
  som_sistema: string | null; som_canais_entrada: number | null; luz_descricao: string | null; luz_refletores: number | null;
  energia_kva: number | null; energia_tensao_v: number | null; energia_fases: number | null; camarins_quantidade: number | null; camarins_capacidade: number | null; notas: string | null;
};
export type CamposDaSala = {
  palcoBoca: string; palcoProfundidade: string; palcoAltura: string; palcoPiso: string; somSistema: string; somCanais: string; luzDescricao: string; luzRefletores: string;
  energiaKva: string; energiaTensao: string; energiaFases: string; camarinsQuantidade: string; camarinsCapacidade: string; notas: string;
};
export type LeituraDaFichaDaSala = { ok: true; ficha: FichaDaSala } | { ok: false; erro: string };

/** A ficha técnica como o banco aceita: medidas em metros, canais até 256, refletores até 5.000, tensão de 100 a 1.000 V, 1 a 3 fases. */
export function lerFichaDaSala(c: CamposDaSala): LeituraDaFichaDaSala {
  const boca = numero(c.palcoBoca, 0, 200), profundidade = numero(c.palcoProfundidade, 0, 200), altura = numero(c.palcoAltura, 0, 100);
  if ([boca, profundidade, altura].includes("erro")) return { ok: false, erro: "As medidas do palco são números em metros (boca e profundidade até 200, altura até 100)." };
  if (c.palcoPiso.length > 200) return { ok: false, erro: "O piso pode ter até 200 letras." };
  if (c.somSistema.length > 500 || c.luzDescricao.length > 500) return { ok: false, erro: "A descrição de som e de luz pode ter até 500 letras." };
  const canais = numero(c.somCanais, 0, 256, true), refletores = numero(c.luzRefletores, 0, 5000, true);
  if (canais === "erro") return { ok: false, erro: "Os canais de entrada são um número inteiro de 0 a 256." };
  if (refletores === "erro") return { ok: false, erro: "Os refletores são um número inteiro de 0 a 5.000." };
  const kva = numero(c.energiaKva, 0, 100000), tensao = numero(c.energiaTensao, 100, 1000, true), fases = numero(c.energiaFases, 1, 3, true);
  if (kva === "erro") return { ok: false, erro: "A potência é um número em kVA, de 0 a 100.000." };
  if (tensao === "erro") return { ok: false, erro: "A tensão é um número inteiro de 100 a 1.000 V." };
  if (fases === "erro") return { ok: false, erro: "As fases são 1, 2 ou 3." };
  const quantidade = numero(c.camarinsQuantidade, 0, 100, true), capacidade = numero(c.camarinsCapacidade, 0, 1000, true);
  if (quantidade === "erro" || capacidade === "erro") return { ok: false, erro: "Camarins: a quantidade vai até 100 e a capacidade até 1.000 pessoas." };
  if (c.notas.length > 4000) return { ok: false, erro: "As notas podem ter até 4.000 letras." };
  return {
    ok: true,
    ficha: {
      palco_boca_m: boca as number | null, palco_profundidade_m: profundidade as number | null, palco_altura_m: altura as number | null, palco_piso: texto(c.palcoPiso),
      som_sistema: texto(c.somSistema), som_canais_entrada: canais, luz_descricao: texto(c.luzDescricao), luz_refletores: refletores,
      energia_kva: kva, energia_tensao_v: tensao, energia_fases: fases, camarins_quantidade: quantidade, camarins_capacidade: capacidade, notas: texto(c.notas),
    },
  };
}

const m = (n: number) => `${n.toLocaleString("pt-BR")} m`;

/** A ficha técnica em linhas curtas ("Palco: boca 10 m × profundidade 8 m"), só com o que está preenchido. */
export function resumoDaFichaDaSala(f: Partial<FichaDaSala>): string[] {
  const linhas: string[] = [];
  const palco = [f.palco_boca_m != null ? `boca ${m(f.palco_boca_m)}` : null, f.palco_profundidade_m != null ? `profundidade ${m(f.palco_profundidade_m)}` : null, f.palco_altura_m != null ? `altura ${m(f.palco_altura_m)}` : null, f.palco_piso ? `piso ${f.palco_piso}` : null].filter(Boolean);
  if (palco.length > 0) linhas.push(`Palco: ${palco.join(" × ")}`);
  const som = [f.som_sistema, f.som_canais_entrada != null ? `${f.som_canais_entrada.toLocaleString("pt-BR")} canais de entrada` : null].filter(Boolean);
  if (som.length > 0) linhas.push(`Som: ${som.join(", ")}`);
  const luz = [f.luz_descricao, f.luz_refletores != null ? `${f.luz_refletores.toLocaleString("pt-BR")} refletores` : null].filter(Boolean);
  if (luz.length > 0) linhas.push(`Luz: ${luz.join(", ")}`);
  const energia = [f.energia_kva != null ? `${f.energia_kva.toLocaleString("pt-BR")} kVA` : null, f.energia_tensao_v != null ? `${f.energia_tensao_v} V` : null, f.energia_fases != null ? `${f.energia_fases} ${f.energia_fases === 1 ? "fase" : "fases"}` : null].filter(Boolean);
  if (energia.length > 0) linhas.push(`Energia: ${energia.join(", ")}`);
  if (f.camarins_quantidade != null || f.camarins_capacidade != null) {
    linhas.push(`Camarins: ${[f.camarins_quantidade != null ? String(f.camarins_quantidade) : null, f.camarins_capacidade != null ? `até ${f.camarins_capacidade.toLocaleString("pt-BR")} pessoas` : null].filter(Boolean).join(", ")}`);
  }
  return linhas;
}
