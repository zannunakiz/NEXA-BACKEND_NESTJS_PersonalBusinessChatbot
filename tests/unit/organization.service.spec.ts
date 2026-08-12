import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { OrganizationService } from '../../src/organization/organization.service';

function createMock() {
  return {
    database: {
      executeRead: jest.fn(async () => []),
      executeReadMain: jest.fn(async () => []),
      executeWrite: jest.fn(async () => undefined),
      executeWriteReturning: jest.fn(async () => []),
    },
    cloudinary: {
      uploadImage: jest.fn(),
      deleteImage: jest.fn(async () => undefined),
    },
  };
}

function createService(db: any, cloudinary: any): OrganizationService {
  return new OrganizationService(db, cloudinary);
}

const orgRow = {
  id: 'org-1',
  owner_id: 'owner-1',
  name: 'Acme',
  description: null,
  image_url: null,
  created_at: new Date(),
};

describe('OrganizationService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('createOrganization', () => {
    it('throws ConflictException on duplicate name', async () => {
      const m = createMock();
      const service = createService(m.database, m.cloudinary);
      m.database.executeReadMain.mockResolvedValueOnce([orgRow]);

      await expect(service.createOrganization('owner-1', 'Acme')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('creates the organization and adds the owner as a member', async () => {
      const m = createMock();
      const service = createService(m.database, m.cloudinary);
      m.database.executeReadMain
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([orgRow]);

      const result = await service.createOrganization('owner-1', 'Acme');
      expect(m.database.executeWrite).toHaveBeenCalledTimes(2);
      expect(result.id).toBe('org-1');
    });
  });

  describe('updateOrganization', () => {
    it('throws ForbiddenException when the caller is not the owner', async () => {
      const m = createMock();
      const service = createService(m.database, m.cloudinary);
      m.database.executeReadMain.mockResolvedValueOnce([{ ...orgRow, owner_id: 'someone-else' }]);

      await expect(
        service.updateOrganization('org-1', 'owner-1', 'New Name'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('transferOwnership', () => {
    it('throws ForbiddenException when the caller is not the owner', async () => {
      const m = createMock();
      const service = createService(m.database, m.cloudinary);
      m.database.executeReadMain.mockResolvedValueOnce([{ owner_id: 'other' }]);

      await expect(
        service.transferOwnership('org-1', 'owner-1', 'new-owner'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('swaps owner role with the new owner on success', async () => {
      const m = createMock();
      const service = createService(m.database, m.cloudinary);
      m.database.executeReadMain
        .mockResolvedValueOnce([{ owner_id: 'owner-1' }])
        .mockResolvedValueOnce([{ id: 'm2', role: 'member' }]);

      await service.transferOwnership('org-1', 'owner-1', 'new-owner');
      expect(m.database.executeWrite).toHaveBeenCalledTimes(3);
    });
  });

  describe('leaveOrganization', () => {
    it('blocks owner from leaving while other members exist', async () => {
      const m = createMock();
      const service = createService(m.database, m.cloudinary);
      m.database.executeReadMain
        .mockResolvedValueOnce([{ id: 'm1', role: 'owner' }])
        .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);

      await expect(service.leaveOrganization('org-1', 'owner-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('removeMember', () => {
    it('prevents an admin from removing another admin', async () => {
      const m = createMock();
      const service = createService(m.database, m.cloudinary);
      m.database.executeReadMain
        .mockResolvedValueOnce([{ role: 'admin' }])
        .mockResolvedValueOnce([
          { id: 't', user_id: 'u2', role: 'admin', organization_id: 'org-1' },
        ]);

      await expect(service.removeMember('org-1', 'admin-1', 't')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('updateMemberRole', () => {
    it('throws ForbiddenException when the caller is not the owner', async () => {
      const m = createMock();
      const service = createService(m.database, m.cloudinary);
      m.database.executeReadMain.mockResolvedValueOnce([{ owner_id: 'other' }]);

      await expect(
        service.updateMemberRole('org-1', 'owner-1', 'member-id', 'admin'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
