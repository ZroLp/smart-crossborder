import Database from 'better-sqlite3';
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
  constructor(db: Database.Database) {
    super(db, 'knowledge_base');
  }

  findByAgentType(agentType: string): KnowledgeBase[] {
    return this.db.prepare('SELECT * FROM knowledge_base WHERE agent_type = ?').all(agentType) as KnowledgeBase[];
  }

  searchByQuestion(agentType: string, keyword: string): KnowledgeBase[] {
    return this.db.prepare('SELECT * FROM knowledge_base WHERE agent_type = ? AND question LIKE ?').all(agentType, `%${keyword}%`) as KnowledgeBase[];
  }

  findByLanguage(language: string): KnowledgeBase[] {
    return this.db.prepare('SELECT * FROM knowledge_base WHERE language = ?').all(language) as KnowledgeBase[];
  }
}
