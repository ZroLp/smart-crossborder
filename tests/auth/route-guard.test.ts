import { checkPermission, PAGE_PERMISSIONS, PAGE_ROUTES } from '@/lib/auth/route-guard';
import { UserRepository } from '@/lib/db/user-repository';

jest.mock('@/lib/db/user-repository');
jest.mock('@/lib/db/init', () => ({
  getDb: jest.fn(() => ({})),
}));

describe('route-guard', () => {
  const mockUserRepo = {
    getRole: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (mockUserRepo.getRole as jest.Mock).mockReturnValue('admin');
  });

  describe('PAGE_PERMISSIONS', () => {
    test('settings is admin-only', () => {
      expect(PAGE_PERMISSIONS['/dashboard/settings']).toEqual(['admin']);
    });

    test('data-center requires admin or operator', () => {
      expect(PAGE_PERMISSIONS['/dashboard/data-center']).toEqual(['admin', 'operator']);
    });

    test('customer-service requires admin or operator', () => {
      expect(PAGE_PERMISSIONS['/dashboard/customer-service']).toEqual(['admin', 'operator']);
    });

    test('admin pages are admin-only', () => {
      expect(PAGE_PERMISSIONS['/admin']).toEqual(['admin']);
      expect(PAGE_PERMISSIONS['/admin/*']).toEqual(['admin']);
    });
  });

  describe('PAGE_ROUTES', () => {
    test('contains all dashboard routes', () => {
      expect(PAGE_ROUTES['/dashboard']).toEqual(['admin', 'operator', 'viewer']);
      expect(PAGE_ROUTES['/dashboard/selection']).toEqual(['admin', 'operator', 'viewer']);
      expect(PAGE_ROUTES['/dashboard/content']).toEqual(['admin', 'operator', 'viewer']);
      expect(PAGE_ROUTES['/dashboard/task-logs']).toEqual(['admin', 'operator', 'viewer']);
      expect(PAGE_ROUTES['/dashboard/compliance']).toEqual(['admin', 'operator', 'viewer']);
    });

    test('admin routes require admin role', () => {
      expect(PAGE_ROUTES['/admin']).toEqual(['admin']);
      expect(PAGE_ROUTES['/admin/users']).toEqual(['admin']);
      expect(PAGE_ROUTES['/admin/shops']).toEqual(['admin']);
    });
  });

  describe('checkPermission', () => {
    test('allows admin to access admin-only pages', () => {
      (mockUserRepo.getRole as jest.Mock).mockReturnValue('admin');
      const result = checkPermission(1, '/dashboard/settings', mockUserRepo as unknown as UserRepository);
      expect(result.allowed).toBe(true);
      expect(result.role).toBe('admin');
    });

    test('denies operator from admin-only pages', () => {
      (mockUserRepo.getRole as jest.Mock).mockReturnValue('operator');
      const result = checkPermission(2, '/dashboard/settings', mockUserRepo as unknown as UserRepository);
      expect(result.allowed).toBe(false);
      expect(result.role).toBe('operator');
    });

    test('denies viewer from operator pages', () => {
      (mockUserRepo.getRole as jest.Mock).mockReturnValue('viewer');
      const result = checkPermission(3, '/dashboard/data-center', mockUserRepo as unknown as UserRepository);
      expect(result.allowed).toBe(false);
      expect(result.role).toBe('viewer');
    });

    test('denies unknown user', () => {
      (mockUserRepo.getRole as jest.Mock).mockReturnValue(null);
      const result = checkPermission(999, '/dashboard/settings', mockUserRepo as unknown as UserRepository);
      expect(result.allowed).toBe(false);
      expect(result.role).toBe('viewer');
    });

    test('strips query parameters from path', () => {
      (mockUserRepo.getRole as jest.Mock).mockReturnValue('admin');
      const result = checkPermission(1, '/dashboard/settings?tab=profile', mockUserRepo as unknown as UserRepository);
      expect(result.allowed).toBe(true);
    });

    test('strips hash from path', () => {
      (mockUserRepo.getRole as jest.Mock).mockReturnValue('admin');
      const result = checkPermission(1, '/dashboard/settings#section-1', mockUserRepo as unknown as UserRepository);
      expect(result.allowed).toBe(true);
    });

    test('allows all roles for unrestricted pages', () => {
      (mockUserRepo.getRole as jest.Mock).mockReturnValue('viewer');
      const result = checkPermission(1, '/dashboard/unknown-page', mockUserRepo as unknown as UserRepository);
      expect(result.allowed).toBe(true);
    });
  });
});
