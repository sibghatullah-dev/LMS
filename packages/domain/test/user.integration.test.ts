import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InstitutionModel } from '../src/models/institution.model';
import { UserModel } from '../src/models/user.model';
import {
  adminChangeRole,
  adminCreateUser,
  adminDeactivateUser,
  adminListUsers,
  getUserById,
  updateMe,
} from '../src/services/user.service';
import type { AuthContext } from '../src/rbac/roles';

async function makeInstitution(slug: string) {
  const inst = await InstitutionModel.create({ name: slug, slug });
  return String(inst._id);
}

async function makeAdmin(institutionId: string): Promise<AuthContext> {
  const admin = await UserModel.create({
    institutionId,
    email: `admin-${institutionId}@example.com`,
    fullName: 'Admin',
    role: 'admin',
    status: 'active',
    emailVerifiedAt: new Date(),
  });
  return { userId: String(admin._id), institutionId, role: 'admin' };
}

let institutionId: string;
let admin: AuthContext;

beforeAll(async () => {
  await UserModel.createIndexes();
});

beforeEach(async () => {
  institutionId = await makeInstitution('lumora');
  admin = await makeAdmin(institutionId);
});

describe('admin user management (FR-ADMIN-01)', () => {
  it('creates a user, lists it, and changes its role (audited, self-guarded)', async () => {
    const created = await adminCreateUser(admin, {
      email: 'newbie@example.com',
      fullName: 'Newbie',
      role: 'student',
    });
    expect(created.status).toBe('active');

    const listed = await adminListUsers(admin, { role: 'student', page: 1, pageSize: 20 });
    expect(listed.total).toBe(1);
    expect(listed.users[0]?.email).toBe('newbie@example.com');

    const promoted = await adminChangeRole(admin, created.id, { role: 'instructor' });
    expect(promoted.role).toBe('instructor');

    // Admin cannot change their own role.
    await expect(adminChangeRole(admin, admin.userId, { role: 'student' })).rejects.toMatchObject(
      { httpStatus: 400 },
    );
  });

  it('deactivates a user but refuses self and super_admin', async () => {
    const target = await adminCreateUser(admin, {
      email: 'target@example.com',
      fullName: 'Target',
      role: 'student',
    });
    const deactivated = await adminDeactivateUser(admin, target.id);
    expect(deactivated.status).toBe('deactivated');

    await expect(adminDeactivateUser(admin, admin.userId)).rejects.toMatchObject({
      httpStatus: 400,
    });

    const superAdmin = await UserModel.create({
      institutionId,
      email: 'super@example.com',
      fullName: 'Super',
      role: 'super_admin',
      status: 'active',
    });
    await expect(adminDeactivateUser(admin, String(superAdmin._id))).rejects.toMatchObject({
      httpStatus: 403,
    });
  });
});

describe('tenant isolation (DDD §1.1, NFR-PRIV-02)', () => {
  it('cannot read a user from another institution', async () => {
    const otherInstitution = await makeInstitution('other-school');
    const otherUser = await UserModel.create({
      institutionId: otherInstitution,
      email: 'outsider@example.com',
      fullName: 'Outsider',
      role: 'student',
      status: 'active',
    });

    await expect(getUserById(admin, String(otherUser._id))).rejects.toMatchObject({
      httpStatus: 404,
    });
  });

  it('the same email can exist in two different institutions', async () => {
    const otherInstitution = await makeInstitution('other-school');
    await adminCreateUser(admin, {
      email: 'shared@example.com',
      fullName: 'A',
      role: 'student',
    });
    const otherAdmin = await makeAdmin(otherInstitution);
    await expect(
      adminCreateUser(otherAdmin, { email: 'shared@example.com', fullName: 'B', role: 'student' }),
    ).resolves.toBeTruthy();
  });
});

describe('self profile update', () => {
  it('updates own name and notification preferences', async () => {
    const updated = await updateMe(admin, {
      fullName: 'Renamed Admin',
      notificationPreferences: { sms: true },
    });
    expect(updated.fullName).toBe('Renamed Admin');
    expect(updated.notificationPreferences.sms).toBe(true);
    expect(updated.notificationPreferences.email).toBe(true); // preserved
  });
});
