import { RolesGuard } from '../roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { SystemRole } from '@prisma/client';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function makeContext(userRole: SystemRole): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { systemRole: userRole } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow when no role required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext(SystemRole.USER))).toBe(true);
  });

  it('should allow ADMIN to access ADMIN route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([SystemRole.ADMIN]);
    expect(guard.canActivate(makeContext(SystemRole.ADMIN))).toBe(true);
  });

  it('should deny USER from ADMIN route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([SystemRole.ADMIN]);
    expect(guard.canActivate(makeContext(SystemRole.USER))).toBe(false);
  });
});
