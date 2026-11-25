import { describe, expect, it } from 'vitest';
import {
  calculateEstimatedPrizeShare,
  calculateGameOdds,
  calculatePoolCombinedOdds,
  checkGameAgainstDraw,
  ESTIMATED_MEGA_VIRADA_PRIZE,
  TOTAL_COMBINATIONS,
} from './lottery';

describe('Mega-Sena lottery odds and result checker', () => {
  it('matches official Caixa odds for 6 and 7 numbers', () => {
    const six = calculateGameOdds(6);
    expect(six.equivalentSimpleBets).toBe(1);
    expect(six.senaOneIn).toBe(TOTAL_COMBINATIONS); // 50.063.860
    expect(six.quinaOneIn).toBe(154_518);
    expect(six.quadraOneIn).toBe(2_332);

    const seven = calculateGameOdds(7);
    expect(seven.equivalentSimpleBets).toBe(7);
    expect(seven.senaOneIn).toBe(7_151_980);
  });

  it('computes combined pool odds accurately', () => {
    const combined = calculatePoolCombinedOdds([
      [1, 2, 3, 4, 5, 6, 7], // 7 apostas simples
      [10, 11, 12, 13, 14, 15, 16, 17], // 28 apostas simples
    ]);
    expect(combined.totalEquivalentSimpleBets).toBe(35);
    expect(combined.hasOverlappingGames).toBe(false);
    expect(combined.multiplierVsSingleBet).toBe(35);
    expect(combined.senaOneIn).toBe(Math.round(TOTAL_COMBINATIONS / 35));
  });

  it('counts multiple prizes on multi-number tickets correctly', () => {
    // Volante de 7 dezenas acertando 5 números ganha 2 Quinas e 5 Quadras (regra Caixa)
    const res = checkGameAgainstDraw(
      [4, 12, 23, 38, 45, 59, 60],
      [4, 12, 23, 38, 45, 50]
    );
    expect(res.hitCount).toBe(5);
    expect(res.senaCount).toBe(0);
    expect(res.quinaCount).toBe(2);
    expect(res.quadraCount).toBe(5);
  });

  it('computes estimated prize share per quota and for player requested quotas', () => {
    const share = calculateEstimatedPrizeShare(100, 3);
    expect(share.estimatedPrize).toBe(ESTIMATED_MEGA_VIRADA_PRIZE);
    expect(share.poolTotalQuotas).toBe(100);
    expect(share.perQuota).toBe(10_000_000);
    expect(share.playerRequestedQuotas).toBe(3);
    expect(share.playerEstimatedReturn).toBe(30_000_000);

    const zeroPlayer = calculateEstimatedPrizeShare(100, 0);
    expect(zeroPlayer.playerEstimatedReturn).toBe(0);
  });
});
