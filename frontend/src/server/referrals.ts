import { prisma } from './db';

export function normalizeAddress(addr: string): string {
  return addr.toLowerCase();
}

/** Add bet volume to matching referral rows for this referee + market. */
export async function attributeReferralVolume(
  marketId: string,
  refereeId: string,
  amountWei: string,
): Promise<void> {
  const market = normalizeAddress(marketId);
  const referee = normalizeAddress(refereeId);
  const delta = BigInt(amountWei);

  const referrals = await prisma.referral.findMany({
    where: { marketId: market, refereeId: referee },
  });

  await Promise.all(
    referrals.map((r) => {
      const next = BigInt(r.volumeGenerated) + delta;
      return prisma.referral.update({
        where: { id: r.id },
        data: { volumeGenerated: next.toString() },
      });
    }),
  );
}
