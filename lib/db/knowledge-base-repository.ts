import { DbClient } from './client';
import { BaseRepository } from './base-repository';

interface KnowledgeBase {
  id: number;
  agent_type: string;
  question: string;
  answer: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export class KnowledgeBaseRepository extends BaseRepository<KnowledgeBase> {
  constructor(db: DbClient) {
    super(db, 'knowledge_base');
  }

  async findByAgentType(agentType: string): Promise<KnowledgeBase[]> {
    return (await this.db.prepare('SELECT * FROM knowledge_base WHERE agent_type = ?').all(agentType)) as KnowledgeBase[];
  }

  async searchByQuestion(agentType: string, keyword: string): Promise<KnowledgeBase[]> {
    return (await this.db.prepare('SELECT * FROM knowledge_base WHERE agent_type = ? AND question LIKE ?').all(agentType, `%${keyword}%`)) as KnowledgeBase[];
  }

  async findByLanguage(language: string): Promise<KnowledgeBase[]> {
    return (await this.db.prepare('SELECT * FROM knowledge_base WHERE language = ?').all(language)) as KnowledgeBase[];
  }
}
