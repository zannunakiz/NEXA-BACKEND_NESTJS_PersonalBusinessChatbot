// src/organization/organization.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import 'multer';
import { v4 as uuidv4 } from 'uuid';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { DatabaseService } from '../database/database.service';
import { MemberRole } from './dto/organization.dto';

export interface UserRow {
  id: string;
  email: string;
}

export interface MemberRow {
  id: string;
  user_id: string;
  role: MemberRole;
  joined_at: Date;
  email: string;
  username: string;
}

export interface OrganizationRow {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: Date;
}

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ---------- CREATE ----------
  async createOrganization(
    ownerId: string,
    name: string,
    description?: string,
  ): Promise<OrganizationRow> {
    const existing =
      await this.databaseService.executeReadMain<OrganizationRow>(
        'SELECT id FROM organizations WHERE owner_id = $1 AND name = $2',
        [ownerId, name],
      );
    if (existing.length > 0) {
      throw new ConflictException(
        'You already have an organization with this name',
      );
    }

    const orgId = uuidv4();

    await this.databaseService.executeWrite(
      'INSERT INTO organizations (id, owner_id, name, description) VALUES ($1, $2, $3, $4)',
      [orgId, ownerId, name, description || null],
    );

    await this.databaseService.executeWrite(
      'INSERT INTO members (organization_id, user_id, role) VALUES ($1, $2, $3)',
      [orgId, ownerId, MemberRole.OWNER],
    );

    return this.getOrganizationById(orgId);
  }

  // ---------- READ ----------
  async getOrganizationById(organizationId: string): Promise<OrganizationRow> {
    const rows = await this.databaseService.executeReadMain<OrganizationRow>(
      'SELECT * FROM organizations WHERE id = $1',
      [organizationId],
    );
    if (rows.length === 0) {
      throw new NotFoundException('Organization not found');
    }
    return rows[0];
  }

  async getOrganizationByIdForMember(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationRow> {
    await this.assertMembership(organizationId, userId);
    return this.getOrganizationById(organizationId);
  }

  async getOrganizationsForUser(
    userId: string,
  ): Promise<(OrganizationRow & { role: MemberRole })[]> {
    const rows = await this.databaseService.executeReadMain<
      OrganizationRow & { role: MemberRole }
    >(
      `SELECT o.*, m.role 
       FROM organizations o 
       JOIN members m ON m.organization_id = o.id 
       WHERE m.user_id = $1 
       ORDER BY o.created_at DESC`,
      [userId],
    );
    return rows;
  }

  async getOrganizationMembers(organizationId: string): Promise<MemberRow[]> {
    const rows = await this.databaseService.executeReadMain<MemberRow>(
      `SELECT m.id, m.user_id, m.role, m.joined_at, u.email, u.username 
       FROM members m 
       JOIN users u ON u.id = m.user_id 
       WHERE m.organization_id = $1 
       ORDER BY m.joined_at ASC`,
      [organizationId],
    );
    return rows;
  }

  async getOrganizationMembersForMember(
    organizationId: string,
    userId: string,
  ): Promise<MemberRow[]> {
    await this.assertMembership(organizationId, userId);
    return this.getOrganizationMembers(organizationId);
  }

  // ---------- UPDATE (OWNER ONLY) ----------
  async updateOrganization(
    organizationId: string,
    userId: string,
    name?: string,
    description?: string,
  ): Promise<OrganizationRow> {
    this.logger.log(
      `🔍 updateOrganization called: org=${organizationId}, user=${userId}`,
    );

    const orgRow = await this.databaseService.executeReadMain<{
      id: string;
      owner_id: string;
    }>('SELECT id, owner_id FROM organizations WHERE id = $1', [
      organizationId,
    ]);

    if (orgRow.length === 0) {
      throw new NotFoundException('Organization not found');
    }

    const ownerId = orgRow[0].owner_id;
    this.logger.log(`📌 Owner ID: ${ownerId}, Requesting User: ${userId}`);

    if (ownerId !== userId) {
      this.logger.warn(`⛔ User ${userId} is NOT the owner – rejecting update`);
      throw new ForbiddenException(
        'Only the owner can update the organization',
      );
    }

    const memberRows = await this.databaseService.executeReadMain<{
      role: MemberRole;
    }>('SELECT role FROM members WHERE organization_id = $1 AND user_id = $2', [
      organizationId,
      userId,
    ]);

    if (memberRows.length === 0 || memberRows[0].role !== MemberRole.OWNER) {
      this.logger.warn(
        `⛔ User ${userId} is not marked as owner in members table`,
      );
      throw new ForbiddenException(
        'Only the owner can update the organization',
      );
    }

    this.logger.log(`✅ User ${userId} is owner, proceeding with update`);

    if (name !== undefined) {
      const duplicate =
        await this.databaseService.executeReadMain<OrganizationRow>(
          'SELECT id FROM organizations WHERE owner_id = $1 AND name = $2 AND id != $3',
          [userId, name, organizationId],
        );
      if (duplicate.length > 0) {
        throw new ConflictException(
          'You already have an organization with this name',
        );
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }

    if (updates.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    values.push(organizationId);
    const query = `UPDATE organizations SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
    await this.databaseService.executeWrite(query, values);

    return this.getOrganizationById(organizationId);
  }

  // ---------- UPDATE BANNER (OWNER ONLY) ----------
  async updateOrganizationBanner(
    organizationId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<OrganizationRow> {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    this.logger.log(
      `🔍 updateOrganizationBanner called: org=${organizationId}, user=${userId}`,
    );

    const orgRow = await this.databaseService.executeReadMain<{
      id: string;
      owner_id: string;
      image_url: string | null;
    }>('SELECT id, owner_id, image_url FROM organizations WHERE id = $1', [
      organizationId,
    ]);

    if (orgRow.length === 0) {
      throw new NotFoundException('Organization not found');
    }

    const ownerId = orgRow[0].owner_id;

    if (ownerId !== userId) {
      this.logger.warn(`⛔ User ${userId} is NOT the owner – rejecting update`);
      throw new ForbiddenException(
        'Only the owner can update the organization banner',
      );
    }

    const memberRows = await this.databaseService.executeReadMain<{
      role: MemberRole;
    }>('SELECT role FROM members WHERE organization_id = $1 AND user_id = $2', [
      organizationId,
      userId,
    ]);

    if (memberRows.length === 0 || memberRows[0].role !== MemberRole.OWNER) {
      this.logger.warn(
        `⛔ User ${userId} is not marked as owner in members table`,
      );
      throw new ForbiddenException(
        'Only the owner can update the organization banner',
      );
    }

    const currentImageUrl = orgRow[0].image_url;

    let finalImageUrl: string;

    try {
      if (currentImageUrl) {
        await this.cloudinaryService.deleteImage(currentImageUrl);
      }

      const uploadResult = await this.cloudinaryService.uploadImage(
        file,
        'NEXA_nestjs/organizations',
      );
      finalImageUrl = uploadResult.secure_url;
    } catch (error) {
      this.logger.error(
        `Cloudinary upload failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(
        'Failed to upload image to Cloudinary. Please try again.',
      );
    }

    await this.databaseService.executeWrite(
      'UPDATE organizations SET image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [finalImageUrl, organizationId],
    );

    return this.getOrganizationById(organizationId);
  }

  // ---------- DELETE (OWNER ONLY, NO OTHER MEMBERS) ----------
  async deleteOrganization(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const orgRow = await this.databaseService.executeReadMain<{
      id: string;
      owner_id: string;
      image_url: string | null;
    }>('SELECT id, owner_id, image_url FROM organizations WHERE id = $1', [
      organizationId,
    ]);

    if (orgRow.length === 0) {
      throw new NotFoundException('Organization not found');
    }

    if (orgRow[0].owner_id !== userId) {
      throw new ForbiddenException(
        'Only the owner can delete the organization',
      );
    }

    const members = await this.getOrganizationMembers(organizationId);
    if (members.length > 1) {
      throw new BadRequestException(
        'Cannot delete organization with other members. Remove or transfer ownership first.',
      );
    }

    const imageUrl = orgRow[0].image_url;

    if (imageUrl) {
      try {
        await this.cloudinaryService.deleteImage(imageUrl);
        this.logger.log(`✅ Deleted Cloudinary image: ${imageUrl}`);
      } catch (error) {
        this.logger.warn(
          `Failed to delete Cloudinary image: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    await this.databaseService.executeWrite(
      'DELETE FROM organizations WHERE id = $1',
      [organizationId],
    );
  }

  // ---------- INVITE MEMBER (OWNER OR ADMIN) ----------
  async inviteMember(
    organizationId: string,
    inviterId: string,
    email: string,
    role: MemberRole,
  ): Promise<MemberRow[]> {
    const inviterRows = await this.databaseService.executeReadMain<{
      role: MemberRole;
    }>('SELECT role FROM members WHERE organization_id = $1 AND user_id = $2', [
      organizationId,
      inviterId,
    ]);
    if (inviterRows.length === 0) {
      throw new ForbiddenException('You are not a member of this organization');
    }
    const inviterRole = inviterRows[0].role;
    if (inviterRole !== MemberRole.OWNER && inviterRole !== MemberRole.ADMIN) {
      throw new ForbiddenException('Only owners and admins can invite members');
    }

    const userRows = await this.databaseService.executeReadMain<UserRow>(
      'SELECT id, email FROM users WHERE email = $1',
      [email],
    );
    if (userRows.length === 0) {
      throw new NotFoundException('User with this email not found');
    }
    const targetUserId = userRows[0].id;

    if (targetUserId === inviterId) {
      throw new BadRequestException('You cannot invite yourself');
    }

    if (role === MemberRole.OWNER) {
      throw new BadRequestException(
        'Use transfer ownership endpoint to make someone owner',
      );
    }

    await this.databaseService.executeWrite(
      'DELETE FROM members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, targetUserId],
    );

    await this.databaseService.executeWrite(
      'INSERT INTO members (organization_id, user_id, role) VALUES ($1, $2, $3)',
      [organizationId, targetUserId, role],
    );

    return this.getOrganizationMembers(organizationId);
  }

  // ---------- UPDATE MEMBER ROLE (OWNER ONLY) ----------
  async updateMemberRole(
    organizationId: string,
    ownerId: string,
    memberId: string,
    newRole: MemberRole,
  ): Promise<MemberRow[]> {
    const orgRow = await this.databaseService.executeReadMain<{
      owner_id: string;
    }>('SELECT owner_id FROM organizations WHERE id = $1', [organizationId]);
    if (orgRow.length === 0) {
      throw new NotFoundException('Organization not found');
    }
    if (orgRow[0].owner_id !== ownerId) {
      throw new ForbiddenException('Only the owner can change member roles');
    }

    const member = await this.getMemberById(memberId);
    if (!member || member.organization_id !== organizationId) {
      throw new NotFoundException('Member not found in this organization');
    }

    if (member.user_id === ownerId) {
      throw new BadRequestException('Cannot change role of the owner');
    }

    if (newRole === MemberRole.OWNER) {
      throw new BadRequestException(
        'Use transfer ownership endpoint to make someone owner',
      );
    }

    await this.databaseService.executeWrite(
      'UPDATE members SET role = $1 WHERE id = $2',
      [newRole, memberId],
    );

    return this.getOrganizationMembers(organizationId);
  }

  // ---------- REMOVE MEMBER (OWNER or ADMIN with restrictions) ----------
  async removeMember(
    organizationId: string,
    actorId: string,
    targetMemberId: string,
  ): Promise<MemberRow[]> {
    const actorRows = await this.databaseService.executeReadMain<{
      role: MemberRole;
    }>('SELECT role FROM members WHERE organization_id = $1 AND user_id = $2', [
      organizationId,
      actorId,
    ]);
    if (actorRows.length === 0) {
      throw new ForbiddenException('You are not a member of this organization');
    }
    const actorRole = actorRows[0].role;

    const targetMember = await this.getMemberById(targetMemberId);
    if (!targetMember || targetMember.organization_id !== organizationId) {
      throw new NotFoundException('Member not found in this organization');
    }

    if (actorId === targetMember.user_id) {
      throw new BadRequestException('Use leave endpoint to remove yourself');
    }

    const targetRole = targetMember.role;

    if (actorRole === MemberRole.OWNER) {
      if (targetRole === MemberRole.OWNER) {
        throw new BadRequestException(
          'Cannot remove the owner. Transfer ownership first.',
        );
      }
    } else if (actorRole === MemberRole.ADMIN) {
      if (targetRole === MemberRole.OWNER || targetRole === MemberRole.ADMIN) {
        throw new ForbiddenException(
          'Admins cannot remove owners or other admins',
        );
      }
    } else {
      throw new ForbiddenException(
        'You do not have permission to remove members',
      );
    }

    await this.databaseService.executeWrite(
      'DELETE FROM members WHERE id = $1',
      [targetMemberId],
    );
    return this.getOrganizationMembers(organizationId);
  }

  // ---------- LEAVE ORGANIZATION ----------
  async leaveOrganization(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const member = await this.getMemberByUserAndOrg(organizationId, userId);
    if (!member) {
      throw new NotFoundException('You are not a member of this organization');
    }

    const members = await this.getOrganizationMembers(organizationId);
    if (member.role === MemberRole.OWNER) {
      if (members.length > 1) {
        throw new BadRequestException(
          'Owner cannot leave while other members exist. Transfer ownership or remove others first.',
        );
      }
      await this.databaseService.executeWrite(
        'DELETE FROM organizations WHERE id = $1',
        [organizationId],
      );
    } else {
      await this.databaseService.executeWrite(
        'DELETE FROM members WHERE id = $1',
        [member.id],
      );
    }
  }

  // ---------- TRANSFER OWNERSHIP (OWNER ONLY) ----------
  async transferOwnership(
    organizationId: string,
    ownerId: string,
    newOwnerId: string,
  ): Promise<void> {
    const orgRow = await this.databaseService.executeReadMain<{
      owner_id: string;
    }>('SELECT owner_id FROM organizations WHERE id = $1', [organizationId]);
    if (orgRow.length === 0) {
      throw new NotFoundException('Organization not found');
    }
    if (orgRow[0].owner_id !== ownerId) {
      throw new ForbiddenException('Only the owner can transfer ownership');
    }

    const newOwnerMember = await this.getMemberByUserAndOrg(
      organizationId,
      newOwnerId,
    );
    if (!newOwnerMember) {
      throw new NotFoundException(
        'New owner must be a member of the organization',
      );
    }
    if (newOwnerId === ownerId) {
      throw new BadRequestException('New owner cannot be the current owner');
    }

    await this.databaseService.executeWrite(
      'UPDATE organizations SET owner_id = $1 WHERE id = $2',
      [newOwnerId, organizationId],
    );

    await this.databaseService.executeWrite(
      'UPDATE members SET role = $1 WHERE user_id = $2 AND organization_id = $3',
      [MemberRole.MEMBER, ownerId, organizationId],
    );
    await this.databaseService.executeWrite(
      'UPDATE members SET role = $1 WHERE user_id = $2 AND organization_id = $3',
      [MemberRole.OWNER, newOwnerId, organizationId],
    );
  }

  // ---------- PRIVATE HELPERS ----------
  private async assertMembership(
    organizationId: string,
    userId: string,
  ): Promise<MemberRole> {
    const member = await this.getMemberByUserAndOrg(organizationId, userId);
    if (!member) {
      throw new ForbiddenException('You are not a member of this organization');
    }
    return member.role;
  }

  private async getMemberById(memberId: string): Promise<{
    id: string;
    user_id: string;
    role: MemberRole;
    organization_id: string;
  } | null> {
    const rows = await this.databaseService.executeReadMain<{
      id: string;
      user_id: string;
      role: MemberRole;
      organization_id: string;
    }>('SELECT id, user_id, role, organization_id FROM members WHERE id = $1', [
      memberId,
    ]);
    return rows.length ? rows[0] : null;
  }

  private async getMemberByUserAndOrg(
    organizationId: string,
    userId: string,
  ): Promise<{ id: string; role: MemberRole } | null> {
    const rows = await this.databaseService.executeReadMain<{
      id: string;
      role: MemberRole;
    }>(
      'SELECT id, role FROM members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId],
    );
    return rows.length ? rows[0] : null;
  }
}
