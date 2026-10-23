import { UserRepository } from '@/lib/db/user-repository';
import { getDb } from '@/lib/db/init';

export const PAGE_PERMISSIONS: Record<string, string[]> = {
  '/dashboard/settings': ['admin'],
  '/dashboard/data-center': ['admin', 'operator'],
  '/dashboard/customer-service': ['admin', 'operator'],
  '/dashboard/ad-optimizer': ['admin', 'operator'],
  '/dashboard/store-builder': ['admin', 'operator'],
  '/dashboard/fulfillment': ['admin', 'operator'],
  '/admin': ['admin'],
  '/admin/*': ['admin'],
};

export const PAGE_ROUTES: Record<string, string[]> = {
  '/dashboard': ['admin', 'operator', 'viewer'],
  '/dashboard/selection': ['admin', 'operator', 'viewer'],
  '/dashboard/content': ['admin', 'operator', 'viewer'],
  '/dashboard/task-logs': ['admin', 'operator', 'viewer'],
  '/dashboard/compliance': ['admin', 'operator', 'viewer'],
  '/dashboard/settings': ['admin'],
  '/dashboard/data-center': ['admin', 'operator'],
  '/dashboard/customer-service': ['admin', 'operator'],
  '/dashboard/ad-optimizer': ['admin', 'operator'],
  '/dashboard/store-builder': ['admin', 'operator'],
  '/dashboard/fulfillment': ['admin', 'operator'],
  '/admin': ['admin'],
  '/admin/users': ['admin'],
  '/admin/shops': ['admin'],
};

export function checkPermission(userId: number, path: string, userRepo?: UserRepository): { allowed: boolean; role: string } {
  const repo = userRepo || new UserRepository(getDb());
  const role = repo.getRole(userId);

  if (!role) {
    return { allowed: false, role: 'viewer' };
  }

  const normalizedPath = path.split('?')[0].split('#')[0];

  if (PAGE_PERMISSIONS[normalizedPath]) {
    const allowedRoles = PAGE_PERMISSIONS[normalizedPath];
    return { allowed: allowedRoles.includes(role), role };
  }

  return { allowed: true, role };
}
