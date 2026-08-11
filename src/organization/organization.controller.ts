// src/organization/organization.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard, JwtUser } from '../auth/jwt-auth.guard';
import {
  CreateOrganizationDto,
  InviteMemberDto,
  MemberRole,
  TransferOwnershipDto,
  UpdateOrganizationDto,
  UpdateRoleDto,
} from './dto/organization.dto';
import {
  MemberRow,
  OrganizationRow,
  OrganizationService,
} from './organization.service';

interface RequestWithUser extends ExpressRequest {
  user: JwtUser;
}

@Controller('organization')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateOrganizationDto,
  ): Promise<{ message: string; data: OrganizationRow }> {
    const org = await this.organizationService.createOrganization(
      req.user.id,
      dto.name,
      dto.description,
    );
    return { message: 'Organization created successfully', data: org };
  }

  @Get()
  async list(@Req() req: RequestWithUser): Promise<{
    message: string;
    data: (OrganizationRow & { role: MemberRole })[];
  }> {
    const orgs = await this.organizationService.getOrganizationsForUser(
      req.user.id,
    );
    return { message: 'Organizations retrieved successfully', data: orgs };
  }

  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string; data: OrganizationRow }> {
    const org = await this.organizationService.getOrganizationByIdForMember(
      id,
      req.user.id,
    );
    return { message: 'Organization retrieved successfully', data: org };
  }

  @Get(':id/members')
  async listMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string; data: MemberRow[] }> {
    const members =
      await this.organizationService.getOrganizationMembersForMember(
        id,
        req.user.id,
      );
    return { message: 'Members retrieved successfully', data: members };
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<{ message: string; data: OrganizationRow }> {
    const org = await this.organizationService.updateOrganization(
      id,
      req.user.id,
      dto.name,
      dto.description,
    );
    return { message: 'Organization updated successfully', data: org };
  }

  @Delete(':id')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string }> {
    await this.organizationService.deleteOrganization(id, req.user.id);
    return { message: 'Organization deleted successfully' };
  }

  @Post(':id/members/invite')
  async invite(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
    @Body() dto: InviteMemberDto,
  ): Promise<{ message: string; data: MemberRow[] }> {
    const members = await this.organizationService.inviteMember(
      id,
      req.user.id,
      dto.email,
      dto.role,
    );
    return { message: 'Member invited successfully', data: members };
  }

  @Put(':id/members/:memberId/role')
  async updateRole(
    @Param('id', ParseUUIDPipe) orgId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateRoleDto,
  ): Promise<{ message: string; data: MemberRow[] }> {
    const members = await this.organizationService.updateMemberRole(
      orgId,
      req.user.id,
      memberId,
      dto.role,
    );
    return { message: 'Member role updated successfully', data: members };
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @Param('id', ParseUUIDPipe) orgId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string; data: MemberRow[] }> {
    const members = await this.organizationService.removeMember(
      orgId,
      req.user.id,
      memberId,
    );
    return { message: 'Member removed successfully', data: members };
  }

  @Post(':id/leave')
  async leave(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string }> {
    await this.organizationService.leaveOrganization(id, req.user.id);
    return { message: 'You have left the organization' };
  }

  @Post(':id/transfer-ownership')
  async transferOwnership(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
    @Body() dto: TransferOwnershipDto,
  ): Promise<{ message: string }> {
    await this.organizationService.transferOwnership(
      id,
      req.user.id,
      dto.newOwnerId,
    );
    return { message: 'Ownership transferred successfully' };
  }
}
