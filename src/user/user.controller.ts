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
import { Request as ExpressRequest } from 'express';
import 'multer';
import { JwtAuthGuard, JwtUser } from '../auth/jwt-auth.guard';
import { UpdateUserDto } from './dto/user.dto';
import { UserService } from './user.service';

interface RequestWithUser extends ExpressRequest {
  user: JwtUser;
}

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Put()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('image'))
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
