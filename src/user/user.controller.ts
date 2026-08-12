import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Put,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import 'multer';
import { JwtAuthGuard, JwtUser } from '../auth/jwt-auth.guard';
import { UpdateUserDto } from './dto/user.dto';
import { UserService } from './user.service';

interface RequestWithUser extends ExpressRequest {
  user: JwtUser;
}

@ApiTags('User')
@Controller('user')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Put()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  async updateUser(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateUserDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const updatedUser = await this.userService.updateUser(
      req.user.id,
      dto.username,
      file,
    );

    return {
      message: 'User profile updated successfully',
      data: updatedUser,
    };
  }
}
