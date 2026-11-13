export interface EvidenceClaim { id: string; claim: string; status: string; confidence?: number; source_urls?: string[]; sourceUrls?: string[]; claim_type?: string; }
export function verifiedChartPoints(claims: EvidenceClaim[]) {
  const points = [];
  for (const claim of claims) {
    if (!['verified', 'supported'].includes(claim.status) || (claim.confidence ?? 0.7) < 0.65 || /\b(target|forecast|expected to|plans? to|could reach|up to)\b/i.test(claim.claim)) continue;
    const url = (claim.source_urls || claim.sourceUrls || []).find(source => /^https?:\/\//.test(source));
    const match = claim.claim.match(/(?:^|\s)(\d[\d,]*(?:\.\d+)?)\s*(users|customers|attendees|downloads|countries|members|locations|employees|projects|groups|organizations|languages|students|graduates|%)(?=\W|$)/i);
    if (!url || !match) continue;
    const value = Number(match[1].replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;
    points.push({ claimId: claim.id, label: claim.claim.slice(0, 54).trim(), value, unit: match[2].toLowerCase(), sourceUrl: url });
  }
  return points;
}
