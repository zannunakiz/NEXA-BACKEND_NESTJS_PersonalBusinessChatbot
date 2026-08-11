import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum MemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

/** Roles assignable via invite or role update (owner requires transfer endpoint). */
export const ASSIGNABLE_MEMBER_ROLES = [
  MemberRole.ADMIN,
  MemberRole.MEMBER,
] as const;

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateOrganizationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsIn(ASSIGNABLE_MEMBER_ROLES)
  role: MemberRole.ADMIN | MemberRole.MEMBER;
}

export class UpdateRoleDto {
  @IsIn(ASSIGNABLE_MEMBER_ROLES)
  role: MemberRole.ADMIN | MemberRole.MEMBER;
}

export class TransferOwnershipDto {
  @IsUUID()
  newOwnerId: string;
}
