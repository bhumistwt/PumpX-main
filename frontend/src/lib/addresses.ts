export function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || '--';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function isValidEthAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}
