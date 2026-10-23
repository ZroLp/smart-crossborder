import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { UserRepository } from '@/lib/db/user-repository';
import { hashPassword } from '@/lib/auth/password-hash'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userIdStr = searchParams.get('userId');
    if (!userIdStr) {
      return NextResponse.json(
        { success: false, error: 'Missing userId' },
        { status: 400 }
      );
    }
    const userId = parseInt(userIdStr, 10);
    const db = getDb();
    const userRepo = new UserRepository(db);
    const role = userRepo.getRole(userId);
    if (!role) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }
    const user = userRepo.findById(userId)!;
    return NextResponse.json({
      success: true,
      role,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, username, password } = body as {
      action: 'login' | 'register';
      username: string;
      password: string;
    };

    if (!action || !username || !password) {
      return NextResponse.json(
        { success: false, error: 'Missing action, username, or password' },
        { status: 400 }
      );
    }

    const db = getDb();
    const userRepo = new UserRepository(db);

    if (action === 'register') {
      const existing = userRepo.findByUsername(username);
      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Username already exists' },
          { status: 400 }
        );
      }
      const result = userRepo.create({ username, password: hashPassword(password), email: null })
      const role = userRepo.getRole(Number(result.lastInsertRowid)) || 'viewer';
      return NextResponse.json({ success: true, userId: result.lastInsertRowid, role });
    }

    if (action === 'login') {
      const valid = userRepo.verifyPassword(username, password);
      if (!valid) {
        return NextResponse.json({ success: false, error: 'Invalid credentials' });
      }
      const user = userRepo.findByUsername(username);
      const role = userRepo.getRole(user!.id) || 'viewer';
      return NextResponse.json({ success: true, userId: user!.id, role });
    }

    return NextResponse.json(
      { success: false, error: `Invalid action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
