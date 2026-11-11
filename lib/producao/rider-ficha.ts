// O rider contra a ficha da sala (plano do módulo, PD4.3, primeiro corte): compara item a item o que o cenário pede com
// o que a sala tem ("seu cenário pede 10 m de boca de cena; este teatro tem 8 m"). Sem tela e sem banco.

export type PedidoDoRider = {
  palcoLarguraMinM: number | null;
  palcoProfundidadeMinM: number | null;
  /** Canais de entrada que o mapa de palco soma (lib/producao/palco.ts); 0 ou nulo quando não há. */
  canais: number | null;
  /** Carga prevista em watts (a soma do mapa de palco). */
  cargaW: number | null;
};

export type OferecidoPelaSala = {
  palco_boca_m: number | null; palco_profundidade_m: number | null; som_canais_entrada: number | null; energia_kva: number | null;
};

export type SituacaoDaComparacao = "atende" | "nao_atende" | "sem_dado";
export type ItemDaComparacao = { chave: "boca" | "profundidade" | "canais" | "energia"; rotulo: string; pede: string; tem: string | null; situacao: SituacaoDaComparacao; texto: string };

const metros = (n: number) => `${String(Math.round(n * 100) / 100).replace(".", ",")} m`;
const inteiro = (n: number) => n.toLocaleString("pt-BR");
const kva = (n: number) => `${String(Math.round(n * 10) / 10).replace(".", ",")} kVA`;

/** Margem para as medidas: 5 cm de diferença não reprova (medida de trena). */
const FOLGA_M = 0.05;

/**
 * Compara o que o rider pede com o que a ficha da sala diz. Só entra o que o rider pede; o que a ficha não preencheu fica
 * "sem dado" (não é reprovação). A energia compara a carga em watts com a potência instalada em kVA, 1 kVA = 1.000 W
 * (fator de potência 1): é uma conta de ordem de grandeza, e o texto diz "cerca de".
 */
export function compararRiderComSala(pedido: PedidoDoRider, sala: Partial<OferecidoPelaSala> | null): ItemDaComparacao[] {
  const ficha = sala ?? {};
  const itens: ItemDaComparacao[] = [];

  const medida = (chave: "boca" | "profundidade", rotulo: string, pedida: number | null, tida: number | null | undefined, descricao: string) => {
    if (pedida === null) return;
    if (tida === null || tida === undefined) { itens.push({ chave, rotulo, pede: metros(pedida), tem: null, situacao: "sem_dado", texto: `O cenário pede ${metros(pedida)} de ${descricao}; a ficha da sala não diz quanto ela tem.` }); return; }
    const atende = tida + FOLGA_M >= pedida;
    itens.push({
      chave, rotulo, pede: metros(pedida), tem: metros(tida), situacao: atende ? "atende" : "nao_atende",
      texto: atende ? `O cenário pede ${metros(pedida)} de ${descricao}; a sala tem ${metros(tida)}.` : `O cenário pede ${metros(pedida)} de ${descricao}; a sala tem ${metros(tida)}, faltam ${metros(pedida - tida)}.`,
    });
  };
  medida("boca", "Boca de cena", pedido.palcoLarguraMinM, ficha.palco_boca_m, "boca de cena");
  medida("profundidade", "Profundidade do palco", pedido.palcoProfundidadeMinM, ficha.palco_profundidade_m, "profundidade de palco");

  if (pedido.canais !== null && pedido.canais > 0) {
    const pedidos = pedido.canais, tidos = ficha.som_canais_entrada;
    if (tidos === null || tidos === undefined) itens.push({ chave: "canais", rotulo: "Canais de som", pede: inteiro(pedidos), tem: null, situacao: "sem_dado", texto: `O cenário usa ${inteiro(pedidos)} canais de entrada; a ficha da sala não diz quantos a mesa tem.` });
    else itens.push({
      chave: "canais", rotulo: "Canais de som", pede: inteiro(pedidos), tem: inteiro(tidos), situacao: tidos >= pedidos ? "atende" : "nao_atende",
      texto: tidos >= pedidos ? `O cenário usa ${inteiro(pedidos)} canais; a mesa da sala tem ${inteiro(tidos)}.` : `O cenário usa ${inteiro(pedidos)} canais; a mesa da sala tem ${inteiro(tidos)}, faltam ${inteiro(pedidos - tidos)}.`,
    });
  }

  if (pedido.cargaW !== null && pedido.cargaW > 0) {
    const pedidaKva = pedido.cargaW / 1000, tida = ficha.energia_kva;
    if (tida === null || tida === undefined) itens.push({ chave: "energia", rotulo: "Energia", pede: kva(pedidaKva), tem: null, situacao: "sem_dado", texto: `O cenário pede cerca de ${kva(pedidaKva)}; a ficha da sala não diz a potência instalada.` });
    else itens.push({
      chave: "energia", rotulo: "Energia", pede: kva(pedidaKva), tem: kva(tida), situacao: tida >= pedidaKva ? "atende" : "nao_atende",
      texto: tida >= pedidaKva ? `O cenário pede cerca de ${kva(pedidaKva)}; a sala tem ${kva(tida)}.` : `O cenário pede cerca de ${kva(pedidaKva)}; a sala tem ${kva(tida)}, faltam cerca de ${kva(pedidaKva - tida)}.`,
    });
  }
  return itens;
}

/** O resumo em uma frase: "2 de 4 itens atendidos, 1 não atende, 1 sem dado". */
export function resumoDaComparacao(itens: readonly ItemDaComparacao[]): string {
  if (itens.length === 0) return "O rider não pede medida, canal nem energia para comparar.";
  const atendem = itens.filter(item => item.situacao === "atende").length;
  const naoAtendem = itens.filter(item => item.situacao === "nao_atende").length;
  const semDado = itens.filter(item => item.situacao === "sem_dado").length;
  return `${atendem} de ${itens.length} ${itens.length === 1 ? "item atendido" : "itens atendidos"}${naoAtendem > 0 ? `, ${naoAtendem} não ${naoAtendem === 1 ? "atende" : "atendem"}` : ""}${semDado > 0 ? `, ${semDado} sem dado na ficha` : ""}.`;
}
