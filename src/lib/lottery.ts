/**
 * Matemática exata da Mega-Sena / Mega da Virada (60 dezenas, sorteio de 6).
 * Suporta volantes de 6 a 20 dezenas, probabilidades individuais e acumuladas,
 * além do conferidor de resultado com contagem exata de múltiplas premiações.
 */

export const TOTAL_NUMBERS = 60;
export const DRAW_SIZE = 6;
export const TOTAL_COMBINATIONS = 50_063_860; // C(60, 6)
export const ESTIMATED_MEGA_VIRADA_PRIZE = 1_000_000_000; // R$ 1 bilhão
export const MEGA_VIRADA_OFFICIAL_URL =
  'https://www.loteriasonline.caixa.gov.br/silce-web/#/mega-sena/especial';

export function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const r = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= r; i++) {
    result = (result * (n - r + i)) / i;
  }
  return Math.round(result);
}

export interface GameOdds {
  numberCount: number;
  equivalentSimpleBets: number; // C(k, 6)
  senaProbability: number;
  quinaProbability: number;
  quadraProbability: number;
  senaOneIn: number;
  quinaOneIn: number;
  quadraOneIn: number;
}

/**
 * Probabilidade exata (hipergeométrica) de um volante com `k` dezenas (6..20)
 * acertar exatamente 6 (Sena), 5 (Quina) ou 4 (Quadra) das 6 dezenas sorteadas.
 */
export function calculateGameOdds(numberCount: number): GameOdds {
  const k = Math.max(6, Math.min(20, Math.floor(numberCount)));
  const senaWays = combinations(k, 6);
  const quinaWays = combinations(k, 5) * combinations(TOTAL_NUMBERS - k, 1);
  const quadraWays = combinations(k, 4) * combinations(TOTAL_NUMBERS - k, 2);

  const senaProbability = senaWays / TOTAL_COMBINATIONS;
  const quinaProbability = quinaWays / TOTAL_COMBINATIONS;
  const quadraProbability = quadraWays / TOTAL_COMBINATIONS;

  return {
    numberCount: k,
    equivalentSimpleBets: senaWays,
    senaProbability,
    quinaProbability,
    quadraProbability,
    senaOneIn: senaProbability > 0 ? Math.round(1 / senaProbability) : Infinity,
    quinaOneIn:
      quinaProbability > 0 ? Math.round(1 / quinaProbability) : Infinity,
    quadraOneIn:
      quadraProbability > 0 ? Math.round(1 / quadraProbability) : Infinity,
  };
}

export interface PoolCombinedOdds {
  totalGames: number;
  totalEquivalentSimpleBets: number;
  senaCombinedProbability: number;
  quinaCombinedProbability: number;
  quadraCombinedProbability: number;
  senaOneIn: number;
  quinaOneIn: number;
  quadraOneIn: number;
  multiplierVsSingleBet: number;
  hasOverlappingGames: boolean;
}

/**
 * Calcula a probabilidade acumulada do conjunto de jogos do bolão.
 * - Verifica se existem jogos com 6+ dezenas em comum (sobreposição na Sena).
 * - Para Sena, sem sobreposição >= 6, a soma das combinações é exata;
 *   para Quina/Quadra (ou com sobreposição), usa a combinação independente 1 - Π(1 - p_i).
 */
export function calculatePoolCombinedOdds(
  gamesNumbers: number[][]
): PoolCombinedOdds {
  if (gamesNumbers.length === 0) {
    return {
      totalGames: 0,
      totalEquivalentSimpleBets: 0,
      senaCombinedProbability: 0,
      quinaCombinedProbability: 0,
      quadraCombinedProbability: 0,
      senaOneIn: Infinity,
      quinaOneIn: Infinity,
      quadraOneIn: Infinity,
      multiplierVsSingleBet: 0,
      hasOverlappingGames: false,
    };
  }

  const oddsList = gamesNumbers.map((nums) => calculateGameOdds(nums.length));
  const totalEquivalentSimpleBets = oddsList.reduce(
    (sum, o) => sum + o.equivalentSimpleBets,
    0
  );

  // Detecta se algum par de jogos compartilha >= 6 dezenas
  let hasOverlappingGames = false;
  for (let i = 0; i < gamesNumbers.length && !hasOverlappingGames; i++) {
    const setA = new Set(gamesNumbers[i]);
    for (let j = i + 1; j < gamesNumbers.length; j++) {
      let shared = 0;
      for (const n of gamesNumbers[j]) {
        if (setA.has(n)) shared++;
      }
      if (shared >= 6) {
        hasOverlappingGames = true;
        break;
      }
    }
  }

  const senaCombinedProbability = hasOverlappingGames
    ? 1 - oddsList.reduce((acc, o) => acc * (1 - o.senaProbability), 1)
    : Math.min(1, totalEquivalentSimpleBets / TOTAL_COMBINATIONS);

  const quinaCombinedProbability =
    1 - oddsList.reduce((acc, o) => acc * (1 - o.quinaProbability), 1);

  const quadraCombinedProbability =
    1 - oddsList.reduce((acc, o) => acc * (1 - o.quadraProbability), 1);

  const singleSenaProb = 1 / TOTAL_COMBINATIONS;

  return {
    totalGames: gamesNumbers.length,
    totalEquivalentSimpleBets,
    senaCombinedProbability,
    quinaCombinedProbability,
    quadraCombinedProbability,
    senaOneIn:
      senaCombinedProbability > 0
        ? Math.max(1, Math.round(1 / senaCombinedProbability))
        : Infinity,
    quinaOneIn:
      quinaCombinedProbability > 0
        ? Math.max(1, Math.round(1 / quinaCombinedProbability))
        : Infinity,
    quadraOneIn:
      quadraCombinedProbability > 0
        ? Math.max(1, Math.round(1 / quadraCombinedProbability))
        : Infinity,
    multiplierVsSingleBet:
      senaCombinedProbability > 0
        ? Math.round(senaCombinedProbability / singleSenaProb)
        : 0,
    hasOverlappingGames,
  };
}

export interface GameCheckResult {
  matchedNumbers: number[];
  hitCount: number;
  senaCount: number;
  quinaCount: number;
  quadraCount: number;
}

/**
 * Confere um volante de `k` dezenas contra as 6 dezenas sorteadas,
 * calculando inclusive múltiplas premiações em volantes de 7+ dezenas
 * (regra oficial da Caixa).
 */
export function checkGameAgainstDraw(
  gameNumbers: number[],
  drawNumbers: number[]
): GameCheckResult {
  const drawSet = new Set(drawNumbers);
  const matchedNumbers = gameNumbers
    .filter((n) => drawSet.has(n))
    .sort((a, b) => a - b);
  const hits = matchedNumbers.length;
  const k = gameNumbers.length;
  const nonHits = k - hits;

  // Quantos subconjuntos de 6 dezenas dentro deste volante contêm 6, 5 ou 4 acertos:
  const senaCount = hits >= 6 ? combinations(hits, 6) * combinations(nonHits, 0) : 0;
  const quinaCount =
    hits >= 5 ? combinations(hits, 5) * combinations(nonHits, 1) : 0;
  const quadraCount =
    hits >= 4 ? combinations(hits, 4) * combinations(nonHits, 2) : 0;

  return {
    matchedNumbers,
    hitCount: hits,
    senaCount,
    quinaCount,
    quadraCount,
  };
}

export function formatOneIn(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `1 em ${n.toLocaleString('pt-BR')}`;
}

export function formatPercent(p: number): string {
  if (p <= 0) return '0%';
  const pct = p * 100;
  if (pct >= 1) return `${pct.toFixed(2).replace('.', ',')}%`;
  if (pct >= 0.01) return `${pct.toFixed(4).replace('.', ',')}%`;
  return `${pct.toFixed(6).replace('.', ',')}%`;
}

export function parseLotteryNumbers(input: string): number[] {
  const tokens = input
    .split(/[^0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => Number(t))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 60);
  return Array.from(new Set(tokens)).sort((a, b) => a - b);
}

export interface EstimatedPrizeShare {
  estimatedPrize: number;
  poolTotalQuotas: number;
  perQuota: number;
  playerRequestedQuotas: number;
  playerEstimatedReturn: number;
}

/**
 * Simula o retorno bruto por cota e o total proporcional às cotas pedidas
 * pelo participante para um prêmio principal estimado (padrão: R$ 1 bilhão).
 */
export function calculateEstimatedPrizeShare(
  poolTotalQuotas: number,
  playerRequestedQuotas: number,
  estimatedPrize = ESTIMATED_MEGA_VIRADA_PRIZE
): EstimatedPrizeShare {
  const safePoolQuotas = Math.max(1, Math.floor(poolTotalQuotas));
  const safePlayerQuotas = Math.max(0, Math.floor(playerRequestedQuotas));
  const perQuota = Number((estimatedPrize / safePoolQuotas).toFixed(2));
  const playerEstimatedReturn = Number((perQuota * safePlayerQuotas).toFixed(2));

  return {
    estimatedPrize,
    poolTotalQuotas: safePoolQuotas,
    perQuota,
    playerRequestedQuotas: safePlayerQuotas,
    playerEstimatedReturn,
  };
}
