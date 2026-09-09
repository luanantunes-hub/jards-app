export const SPONSORSHIP_TYPE_OPTIONS = [
  { value: "lei_rouanet", label: "Lei Rouanet" },
  { value: "lei_audiovisual", label: "Lei do Audiovisual" },
  { value: "lei_incentivo_esporte", label: "Lei de Incentivo ao Esporte" },
  { value: "pronon", label: "PRONON" },
  { value: "pronas_pcd", label: "PRONAS/PCD" },
  { value: "patrocinio_direto", label: "Patrocínio direto" },
] as const;

export const BRAZIL_STATES = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"],
  ["BA", "Bahia"], ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"],
  ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"], ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
  ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"],
  ["SP", "São Paulo"], ["SE", "Sergipe"], ["TO", "Tocantins"],
] as const;

const SPONSORSHIP_LABELS = new Map<string, string>(
  [
    ...SPONSORSHIP_TYPE_OPTIONS.map(option => [option.value, option.label] as const),
    ["proac_icms", "ProAC ICMS · SP"],
    ["promac", "Pro-Mac · São Paulo/SP"],
    ["fia", "Fundo da Infância e Adolescência"],
    ["fundo_idoso", "Fundo do Idoso"],
  ],
);

export function sponsorshipTypeLabel(value: string): string {
  if (value.startsWith("estadual:")) return `Estadual · ${value.slice(9)}`;
  if (value.startsWith("municipal:")) return `Municipal · ${value.slice(10)}`;
  return SPONSORSHIP_LABELS.get(value) ?? value;
}

const SPONSORSHIP_COLORS = new Map<string, string>([
  ["lei_rouanet", "#7259B5"],
  ["lei_audiovisual", "#1A8B7A"],
  ["lei_incentivo_esporte", "#2D72B0"],
  ["pronon", "#C2517F"],
  ["pronas_pcd", "#C2517F"],
  ["patrocinio_direto", "#595959"],
  ["proac_icms", "#5B7C99"],
  ["promac", "#8B6F47"],
  ["fia", "#C2517F"],
  ["fundo_idoso", "#C2517F"],
]);

export function sponsorshipTypeColor(value: string): string {
  if (value.startsWith("estadual:")) return "#5B7C99";
  if (value.startsWith("municipal:")) return "#8B6F47";
  return SPONSORSHIP_COLORS.get(value) ?? "#595959";
}
