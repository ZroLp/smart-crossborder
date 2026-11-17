export interface AdCampaignRow {
  id: number;
  external_id: string;
  name: string;
  platform: string;
  status: string;
  budget: number | null;
  spent: number | null;
  roas: number | null;
  clicks: number | null;
  conversions: number | null;
  ctr: number | null;
  audience_json: string | null;
  creatives_json: string | null;
  created_at: string;
}

export interface AdSuggestionRow {
  id: number;
  campaign_external_id: string | null;
  type: string;
  title: string;
  description: string | null;
  expected_impact: string | null;
  action: string | null;
  status: string;
  created_at: string;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function mapCampaign(row: AdCampaignRow) {
  return {
    id: row.id,
    externalId: row.external_id,
    name: row.name,
    platform: row.platform,
    status: row.status,
    budget: row.budget ?? 0,
    spent: row.spent ?? 0,
    roas: row.roas ?? 0,
    clicks: row.clicks ?? 0,
    conversions: row.conversions ?? 0,
    ctr: row.ctr ?? 0,
    audience: parseJson<Record<string, unknown>>(row.audience_json, {}),
    creatives: parseJson<Array<Record<string, unknown>>>(row.creatives_json, []),
    createdAt: row.created_at,
  };
}

export function mapSuggestion(row: AdSuggestionRow) {
  return {
    id: row.id,
    campaignExternalId: row.campaign_external_id,
    type: row.type,
    title: row.title,
    description: row.description,
    expectedImpact: row.expected_impact,
    action: row.action,
    status: row.status,
    createdAt: row.created_at,
  };
}
