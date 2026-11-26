import { DbClient } from './client';

export interface AdCampaign {
  id: number;
  user_id: number;
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

export interface AdSuggestion {
  id: number;
  user_id: number;
  campaign_external_id: string | null;
  type: string;
  title: string;
  description: string | null;
  expected_impact: string | null;
  action: string | null;
  status: string;
  created_at: string;
}

export interface AdPlatformConnection {
  id: number;
  user_id: number;
  platform: string;
  status: string;
  connected_at: string | null;
}

export class AdCampaignRepository {
  constructor(private db: DbClient) {}

  // ── Campaigns ────────────────────────────────────────────────────────────────

  async listByUser(userId: number): Promise<AdCampaign[]> {
    return (
      (await this.db
        .prepare('SELECT * FROM ad_campaigns WHERE user_id = ? ORDER BY id')
        .all(userId)) as AdCampaign[]
    );
  }

  async findByIdOrExternalId(
    userId: number,
    idOrExternalId: string
  ): Promise<AdCampaign | undefined> {
    const numericId = /^\d+$/.test(idOrExternalId) ? Number(idOrExternalId) : -1;
    return (
      (await this.db
        .prepare(
          'SELECT * FROM ad_campaigns WHERE user_id = ? AND (id = ? OR external_id = ?)'
        )
        .get(userId, numericId, idOrExternalId)) as AdCampaign | undefined
    );
  }

  async create(
    userId: number,
    input: {
      external_id: string;
      name: string;
      platform: string;
      status?: string;
      budget?: number;
      spent?: number;
      roas?: number;
      clicks?: number;
      conversions?: number;
      ctr?: number;
      audience_json?: string | null;
      creatives_json?: string | null;
    }
  ): Promise<AdCampaign> {
    const result = await this.db
      .prepare(
        `INSERT INTO ad_campaigns
          (user_id, external_id, name, platform, status, budget, spent, roas, clicks, conversions, ctr, audience_json, creatives_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        input.external_id,
        input.name,
        input.platform,
        input.status ?? 'active',
        input.budget ?? 0,
        input.spent ?? 0,
        input.roas ?? 0,
        input.clicks ?? 0,
        input.conversions ?? 0,
        input.ctr ?? 0,
        input.audience_json ?? null,
        input.creatives_json ?? null
      );
    // lastInsertRowid is the new id
    const newId = result.lastInsertRowid ?? result.changes;
    return (
      (await this.db
        .prepare('SELECT * FROM ad_campaigns WHERE id = ?')
        .get(newId)) as AdCampaign
    );
  }

  async update(
    userId: number,
    idOrExternalId: string,
    patch: {
      name?: string;
      platform?: string;
      status?: string;
      budget?: number;
      audience_json?: string | null;
      creatives_json?: string | null;
    }
  ): Promise<AdCampaign | undefined> {
    const campaign = await this.findByIdOrExternalId(userId, idOrExternalId);
    if (!campaign) return undefined;

    const fields = Object.keys(patch)
      .filter((k) => patch[k as keyof typeof patch] !== undefined)
      .map((k) => `${k} = ?`)
      .join(', ');
    if (!fields) return campaign;

    const values = Object.values(patch).filter((v) => v !== undefined);
    await this.db
      .prepare(`UPDATE ad_campaigns SET ${fields} WHERE id = ?`)
      .run(...values, campaign.id);

    return (
      (await this.db
        .prepare('SELECT * FROM ad_campaigns WHERE id = ?')
        .get(campaign.id)) as AdCampaign
    );
  }

  async toggleStatus(
    userId: number,
    idOrExternalId: string
  ): Promise<AdCampaign | undefined> {
    const campaign = await this.findByIdOrExternalId(userId, idOrExternalId);
    if (!campaign) return undefined;
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    await this.db
      .prepare('UPDATE ad_campaigns SET status = ? WHERE id = ?')
      .run(newStatus, campaign.id);
    return (
      (await this.db
        .prepare('SELECT * FROM ad_campaigns WHERE id = ?')
        .get(campaign.id)) as AdCampaign
    );
  }

  async delete(userId: number, idOrExternalId: string): Promise<boolean> {
    const campaign = await this.findByIdOrExternalId(userId, idOrExternalId);
    if (!campaign) return false;
    await this.db
      .prepare('DELETE FROM ad_campaigns WHERE id = ?')
      .run(campaign.id);
    return true;
  }

  // ── Suggestions ─────────────────────────────────────────────────────────────

  async listSuggestionsByUser(
    userId: number,
    campaignExternalId?: string
  ): Promise<AdSuggestion[]> {
    if (campaignExternalId) {
      return (
        (await this.db
          .prepare(
            'SELECT * FROM ad_suggestions WHERE user_id = ? AND campaign_external_id = ? ORDER BY id'
          )
          .all(userId, campaignExternalId)) as AdSuggestion[]
      );
    }
    return (
      (await this.db
        .prepare('SELECT * FROM ad_suggestions WHERE user_id = ? ORDER BY id')
        .all(userId)) as AdSuggestion[]
    );
  }

  async updateSuggestionStatus(
    userId: number,
    suggestionId: number,
    status: 'accepted' | 'rejected'
  ): Promise<AdSuggestion | undefined> {
    const row = (
      (await this.db
        .prepare('SELECT * FROM ad_suggestions WHERE id = ? AND user_id = ?')
        .get(suggestionId, userId)) as AdSuggestion | undefined
    );
    if (!row) return undefined;
    await this.db
      .prepare('UPDATE ad_suggestions SET status = ? WHERE id = ?')
      .run(status, suggestionId);
    return { ...row, status };
  }

  // ── Platform connections ─────────────────────────────────────────────────────

  async listPlatformConnections(
    userId: number
  ): Promise<AdPlatformConnection[]> {
    return (
      (await this.db
        .prepare('SELECT * FROM ad_platform_connections WHERE user_id = ? ORDER BY platform')
        .all(userId)) as AdPlatformConnection[]
    );
  }

  async upsertPlatformConnection(
    userId: number,
    platform: string,
    status: 'connected' | 'disconnected'
  ): Promise<AdPlatformConnection> {
    const connectedAt = status === 'connected' ? new Date().toISOString() : null;
    await this.db
      .prepare(
        `INSERT INTO ad_platform_connections (user_id, platform, status, connected_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, platform)
         DO UPDATE SET status = excluded.status, connected_at = excluded.connected_at`
      )
      .run(userId, platform, status, connectedAt);
    return (
      (await this.db
        .prepare(
          'SELECT * FROM ad_platform_connections WHERE user_id = ? AND platform = ?'
        )
        .get(userId, platform)) as AdPlatformConnection
    );
  }

  async isPlatformConnected(
    userId: number,
    platform: string
  ): Promise<boolean> {
    const row = (
      (await this.db
        .prepare(
          "SELECT status FROM ad_platform_connections WHERE user_id = ? AND platform = ?"
        )
        .get(userId, platform)) as { status: string } | undefined
    );
    return row?.status === 'connected';
  }
}
