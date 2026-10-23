import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { UserRepository } from '@/lib/db/user-repository';

export async function GET() {
  try {
    const db = getDb();
    const userRepo = new UserRepository(db);
    const users = userRepo.findAll(1000);
    const safeUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
    }));
    return NextResponse.json({ success: true, users: safeUsers });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
