"use client";
import type { Icon } from "@phosphor-icons/react";
import {
  AmbulanceIcon, AnchorIcon, AtomIcon, BabyCarriageIcon, BabyIcon, BackpackIcon,
  BalloonIcon, BandaidsIcon, BarbellIcon, BaseballCapIcon, BaseballHelmetIcon, BaseballIcon,
  BasketballIcon, BatteryChargingIcon, BatteryFullIcon, BatteryWarningIcon, BeachBallIcon, BedIcon,
  BicycleIcon, BinocularsIcon, BirdIcon, BlueprintIcon, BoneIcon, BookBookmarkIcon,
  BookIcon, BookOpenIcon, BookOpenTextIcon, BookOpenUserIcon, BookmarkIcon, BookmarkSimpleIcon,
  BookmarksIcon, BookmarksSimpleIcon, BooksIcon, BowlingBallIcon, BoxingGloveIcon, BrainIcon,
  BroadcastIcon, BuildingsIcon, ButterflyIcon, CalculatorIcon, CalendarHeartIcon, CameraIcon,
  CameraPlusIcon, CameraRotateIcon, CampfireIcon, CarBatteryIcon, CertificateIcon, ChalkboardIcon,
  ChalkboardSimpleIcon, ChalkboardTeacherIcon, ChartBarHorizontalIcon, ChartBarIcon, ChartDonutIcon, ChartLineDownIcon,
  ChartLineIcon, ChartLineUpIcon, ChartPieIcon, ChartPieSliceIcon, ChartPolarIcon, ChartScatterIcon,
  CircuitryIcon, ClosedCaptioningIcon, CoinsIcon, CompassIcon, CompassRoseIcon, CompassToolIcon,
  ConfettiIcon, CourtBasketballIcon, CpuIcon, CraneIcon, CraneTowerIcon, CrossIcon,
  CrownCrossIcon, CrownIcon, CubeFocusIcon, CubeIcon, CubeTransparentIcon, DiamondIcon,
  DiscoBallIcon, DnaIcon, DropHalfBottomIcon, DropHalfIcon, DropIcon, DropSimpleIcon,
  DropSlashIcon, EarIcon, ExamIcon, EyeIcon, EyedropperIcon, EyedropperSampleIcon,
  FaceMaskIcon, FactoryIcon, FeatherIcon, FileMagnifyingGlassIcon, FilmReelIcon, FilmScriptIcon,
  FilmSlateIcon, FilmStripIcon, FingerprintIcon, FireIcon, FireSimpleIcon, FirstAidIcon,
  FirstAidKitIcon, FlagCheckeredIcon, FlagIcon, FlaskIcon, FootballHelmetIcon, FootballIcon,
  FunctionIcon, GasCanIcon, GaugeIcon, GearIcon, GenderIntersexIcon, GiftIcon,
  GlobeHemisphereEastIcon, GlobeHemisphereWestIcon, GlobeIcon, GlobeSimpleIcon, GlobeStandIcon, GolfIcon,
  GraduationCapIcon, GraphIcon, GraphicsCardIcon, HammerIcon, HandCoinsIcon, HandEyeIcon,
  HandFistIcon, HandGrabbingIcon, HandHeartIcon, HandPalmIcon, HandPeaceIcon, HandPointingIcon,
  HandTapIcon, HandWavingIcon, HandsClappingIcon, HandsPrayingIcon, HandshakeIcon, HardDrivesIcon,
  HardHatIcon, HeadCircuitIcon, HeartBreakIcon, HeartHalfIcon, HeartIcon, HeartStraightBreakIcon,
  HeartStraightIcon, HeartbeatIcon, HockeyIcon, HospitalIcon, HouseIcon, HouseLineIcon,
  HouseSimpleIcon, IdentificationBadgeIcon, ImageIcon, InfinityIcon, LeafIcon, LightbulbFilamentIcon,
  LightbulbIcon, LighthouseIcon, LightningIcon, ListHeartIcon, ListMagnifyingGlassIcon, MagicWandIcon,
  MagnifyingGlassIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, MapPinIcon, MaskHappyIcon, MaskSadIcon,
  MathOperationsIcon, MedalIcon, MedalMilitaryIcon, MegaphoneIcon, MicrophoneIcon, MicrophoneStageIcon,
  MicroscopeIcon, MoonIcon, MountainsIcon, MusicNoteIcon, MusicNoteSimpleIcon, MusicNotesIcon,
  MusicNotesMinusIcon, MusicNotesPlusIcon, MusicNotesSimpleIcon, NotePencilIcon, NotebookIcon, PackageIcon,
  PenNibIcon, PencilCircleIcon, PencilIcon, PencilLineIcon, PencilRulerIcon, PencilSimpleIcon,
  PencilSimpleLineIcon, PersonArmsSpreadIcon, PersonSimpleBikeIcon, PersonSimpleHikeIcon, PersonSimpleRunIcon, PersonSimpleSkiIcon,
  PersonSimpleSnowboardIcon, PersonSimpleSwimIcon, PersonSimpleTaiChiIcon, PersonSimpleThrowIcon, PersonSimpleWalkIcon, PillIcon,
  PipeWrenchIcon, PlanetIcon, PlantIcon, PlugChargingIcon, PlugIcon, PlugsConnectedIcon,
  PlugsIcon, PopcornIcon, PottedPlantIcon, PresentationChartIcon, ProjectorScreenChartIcon, ProjectorScreenIcon,
  PulseIcon, PuzzlePieceIcon, RacquetIcon, RadioIcon, RainbowCloudIcon, RainbowIcon,
  RobotIcon, RocketIcon, RocketLaunchIcon, RulerIcon, ScalesIcon, ScanIcon,
  ScanSmileyIcon, ScrewdriverIcon, SecurityCameraIcon, ShieldCheckIcon, ShieldCheckeredIcon, ShieldChevronIcon,
  ShieldIcon, ShieldPlusIcon, ShieldStarIcon, ShippingContainerIcon, ShootingStarIcon, SmileyIcon,
  SoccerBallIcon, SparkleIcon, SpeakerHifiIcon, SpeakerHighIcon, SpeakerLowIcon, SpiralIcon,
  StarFourIcon, StarIcon, StethoscopeIcon, StudentIcon, SwimmingPoolIcon, SyringeIcon,
  TargetIcon, TennisBallIcon, TestTubeIcon, ThermometerColdIcon, ThermometerHotIcon, ThermometerIcon,
  ThermometerSimpleIcon, TicketIcon, TimerIcon, ToolboxIcon, ToothIcon, TranslateIcon,
  TreeEvergreenIcon, TreeIcon, TreePalmIcon, TreeStructureIcon, TrophyIcon, TruckIcon,
  TruckTrailerIcon, UmbrellaIcon, UmbrellaSimpleIcon, UserCircleIcon, UserFocusIcon, UsersFourIcon,
  UsersIcon, UsersThreeIcon, VideoCameraIcon, VideoConferenceIcon, VideoIcon, VinylRecordIcon,
  VirusIcon, VolleyballIcon, WarehouseIcon, WashingMachineIcon, WheelchairIcon, WheelchairMotionIcon,
  WindIcon, WrenchIcon,
} from "@phosphor-icons/react";

export type ProjetoCategoria = {
  key: string;
  cor: string;
  Icons: Icon[];
};

const CATEGORIAS: (ProjetoCategoria & { keywords: string[] })[] = [
  { key: "audiovisual", cor: "#E2703A", keywords: ["filme", "document", "curta-metragem", "curta metragem", "longa-metragem", "longa metragem", "serie", "audiovisual", "cinema", "producao", "teatro", "musical"], Icons: [BroadcastIcon, CameraIcon, CameraPlusIcon, CameraRotateIcon, FaceMaskIcon, FilmReelIcon, FilmScriptIcon, FilmSlateIcon, FilmStripIcon, ImageIcon, MaskHappyIcon, MaskSadIcon, MicrophoneIcon, MicrophoneStageIcon, MusicNoteIcon, MusicNoteSimpleIcon, MusicNotesIcon, MusicNotesMinusIcon, MusicNotesPlusIcon, MusicNotesSimpleIcon, PopcornIcon, ProjectorScreenIcon, RadioIcon, SecurityCameraIcon, SpeakerHifiIcon, SpeakerHighIcon, SpeakerLowIcon, TicketIcon, VideoIcon, VideoCameraIcon, VideoConferenceIcon, VinylRecordIcon, ConfettiIcon] },
  { key: "esporte", cor: "#2E8932", keywords: ["esport", "futebol", "atlet", "natac", "corrida", "jogos", "campeonato", "olimpi", "paralimpi", "ginastica", "judo", "volei", "basquete", "handebol", "ciclis"], Icons: [BarbellIcon, BaseballIcon, BaseballCapIcon, BaseballHelmetIcon, BasketballIcon, BeachBallIcon, BicycleIcon, BowlingBallIcon, BoxingGloveIcon, CourtBasketballIcon, FlagCheckeredIcon, FootballIcon, FootballHelmetIcon, GolfIcon, HockeyIcon, MedalIcon, MedalMilitaryIcon, MountainsIcon, PersonSimpleBikeIcon, PersonSimpleHikeIcon, PersonSimpleRunIcon, PersonSimpleSkiIcon, PersonSimpleSnowboardIcon, PersonSimpleSwimIcon, PersonSimpleTaiChiIcon, PersonSimpleThrowIcon, RacquetIcon, SoccerBallIcon, SwimmingPoolIcon, TargetIcon, TennisBallIcon, TimerIcon, TrophyIcon, VolleyballIcon, FireIcon, FireSimpleIcon, LightningIcon, WindIcon, RocketIcon, RocketLaunchIcon, SparkleIcon] },
  { key: "inclusao", cor: "#2D72B0", keywords: ["reabilit", "deficien", "inclus", "equoterapia", "acessibilidade", "autis", "especial"], Icons: [HandWavingIcon, ClosedCaptioningIcon, TranslateIcon, FingerprintIcon, GenderIntersexIcon, UserFocusIcon, HandCoinsIcon, HandTapIcon, SmileyIcon, HandFistIcon, HandGrabbingIcon, HandPalmIcon, HandPeaceIcon, HandPointingIcon, HandsClappingIcon, HandsPrayingIcon, HandshakeIcon, PersonArmsSpreadIcon, PersonSimpleWalkIcon, PuzzlePieceIcon, UsersFourIcon, BabyIcon, BabyCarriageIcon, AnchorIcon, UmbrellaIcon, ShieldIcon, ShieldCheckIcon, ShieldStarIcon, CompassIcon, StarIcon, MagicWandIcon] },
  { key: "saude", cor: "#D94E4E", keywords: ["saude", "cancer", "oncolog", "cardio", "clinic", "hospital", "tratamento", "doenca", "paciente", "cirurg", "diagnostic", "transplant", "medic", "misericordia", "irmandade", "radioterapia"], Icons: [AmbulanceIcon, BandaidsIcon, BoneIcon, BrainIcon, CrossIcon, FirstAidIcon, FirstAidKitIcon, HeartIcon, HeartBreakIcon, HeartbeatIcon, HospitalIcon, PillIcon, PulseIcon, StethoscopeIcon, SyringeIcon, ThermometerIcon, ThermometerColdIcon, ThermometerHotIcon, ThermometerSimpleIcon, ToothIcon, VirusIcon, WheelchairIcon, WheelchairMotionIcon, EarIcon, EyeIcon, CalendarHeartIcon, DropIcon, DropHalfIcon, DropHalfBottomIcon, DropSimpleIcon, DropSlashIcon, EyedropperIcon, EyedropperSampleIcon, HandEyeIcon, HandHeartIcon, ListHeartIcon, LeafIcon, BedIcon, MoonIcon, ScalesIcon, CrownCrossIcon, FeatherIcon, ButterflyIcon, RainbowIcon] },
  { key: "pesquisa", cor: "#7259B5", keywords: ["pesquisa", "cientific"], Icons: [BinocularsIcon, MathOperationsIcon, StarFourIcon, InfinityIcon, AtomIcon, CalculatorIcon, ChartBarIcon, ChartBarHorizontalIcon, ChartDonutIcon, ChartLineIcon, ChartLineDownIcon, ChartLineUpIcon, ChartPieIcon, ChartPieSliceIcon, ChartPolarIcon, ChartScatterIcon, CompassRoseIcon, CompassToolIcon, DnaIcon, FileMagnifyingGlassIcon, FlaskIcon, FunctionIcon, GraphIcon, ListMagnifyingGlassIcon, MagnifyingGlassIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, MicroscopeIcon, PlanetIcon, PresentationChartIcon, ProjectorScreenChartIcon, RulerIcon, TestTubeIcon, ShootingStarIcon, SpiralIcon, DiamondIcon] },
  { key: "equipamento", cor: "#B07A14", keywords: ["equipamento", "ressonanc", "aparelho", "reforma", "construc", "infraestrutura", "tomografo", "ambulancia"], Icons: [BlueprintIcon, CpuIcon, HardDrivesIcon, BatteryChargingIcon, BatteryFullIcon, BatteryWarningIcon, CarBatteryIcon, CircuitryIcon, CraneIcon, CraneTowerIcon, CubeIcon, CubeFocusIcon, CubeTransparentIcon, FactoryIcon, GaugeIcon, GraphicsCardIcon, HardHatIcon, HeadCircuitIcon, PackageIcon, PipeWrenchIcon, PlugIcon, PlugChargingIcon, PlugsIcon, PlugsConnectedIcon, RobotIcon, ScanIcon, ScanSmileyIcon, ScrewdriverIcon, ShippingContainerIcon, ToolboxIcon, TruckIcon, TruckTrailerIcon, WashingMachineIcon, WrenchIcon, GearIcon, HammerIcon, GasCanIcon] },
  { key: "educacao", cor: "#1A8B7A", keywords: ["educac", "capacitac", "formacao", "curso", "ensino", "treinamento", "qualificacao"], Icons: [PenNibIcon, IdentificationBadgeIcon, BackpackIcon, BookIcon, BookBookmarkIcon, BookOpenIcon, BookOpenTextIcon, BookOpenUserIcon, BookmarkIcon, BookmarkSimpleIcon, BookmarksIcon, BookmarksSimpleIcon, BooksIcon, CertificateIcon, ChalkboardIcon, ChalkboardSimpleIcon, ChalkboardTeacherIcon, ExamIcon, GraduationCapIcon, LightbulbIcon, LightbulbFilamentIcon, NotePencilIcon, NotebookIcon, PencilIcon, PencilCircleIcon, PencilLineIcon, PencilRulerIcon, PencilSimpleIcon, PencilSimpleLineIcon, StudentIcon, GlobeIcon, GlobeHemisphereEastIcon, GlobeStandIcon, CrownIcon] },
  { key: "comunidade", cor: "#555555", keywords: ["comunidade", "social", "apae", "assoc", "excepcional", "instituto", "fundacao", "assistencia"], Icons: [MegaphoneIcon, MapPinIcon, UserCircleIcon, CoinsIcon, BirdIcon, BuildingsIcon, CampfireIcon, FlagIcon, GiftIcon, GlobeHemisphereWestIcon, GlobeSimpleIcon, HeartHalfIcon, HeartStraightIcon, HeartStraightBreakIcon, HouseIcon, HouseLineIcon, HouseSimpleIcon, LighthouseIcon, PlantIcon, PottedPlantIcon, ShieldCheckeredIcon, ShieldChevronIcon, ShieldPlusIcon, TreeIcon, TreeEvergreenIcon, TreePalmIcon, TreeStructureIcon, UmbrellaSimpleIcon, UsersIcon, UsersThreeIcon, WarehouseIcon, BalloonIcon, DiscoBallIcon, RainbowCloudIcon] },
];

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function classificarProjeto(nome: string): ProjetoCategoria | null {
  const norm = normalizar(nome);
  for (const cat of CATEGORIAS) {
    if (cat.keywords.some((k) => norm.includes(k))) return cat;
  }
  return null;
}

const CATEGORIA_POR_LEI: Record<string, string> = {
  ancine: "audiovisual",
  esporte: "esporte",
};

function hash(id: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

// Ancine e esporte já sabem sua categoria pela própria lei (todo projeto ancine é
// audiovisual) — só saúde precisa da heurística de palavra-chave, porque agrupa temas
// heterogêneos (hospital, pesquisa, inclusão etc.) sob uma única lei. Quando nem isso
// resolve (nome sem nenhuma palavra-chave reconhecida), sorteia entre as categorias
// existentes em vez de cair no cinza — mesmo projeto sempre sorteia a mesma, via hash do id.
export function categoriaDoProjeto(nome: string, lei: string, projetoId: string): ProjetoCategoria {
  const porLei = CATEGORIA_POR_LEI[lei];
  if (porLei) return CATEGORIAS.find((c) => c.key === porLei) ?? CATEGORIAS[0];
  return classificarProjeto(nome) ?? CATEGORIAS[hash(projetoId, 7) % CATEGORIAS.length];
}

const CINZA_METALICO = "#8E8E93";

export function ProjetoCategoriaIlustracao({ categoria, projetoId, size = 44 }: { categoria: ProjetoCategoria; projetoId: string; size?: number }) {
  const { Icons } = categoria;
  const IconCmp = Icons[hash(projetoId, 17) % Icons.length];
  const corte = 25 + (hash(projetoId, 31) % 45);
  return (
    <div className="rounded overflow-hidden flex-shrink-0 relative" style={{ width: size, height: size, background: CINZA_METALICO + "14" }}>
      <div className="absolute inset-0" style={{ background: CINZA_METALICO + "26", clipPath: `polygon(100% 0, 100% 100%, ${corte}% 100%)` }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <IconCmp size={Math.round(size * 0.48)} color="#0D0D0D" weight="duotone" />
      </div>
    </div>
  );
}
