import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClearDbRequest, ClearDbResponse } from './dto/cleardb.dto';
import { GetAllUsersRequest, GetAllUsersResponse } from './dto/getallusers.dto';
import { MasterService } from './master.service';

@ApiTags('Master')
@Controller('master')
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  @Post('getallusers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all registered users' })
  async getAllUsers(
    @Body() body: GetAllUsersRequest,
  ): Promise<{ data: GetAllUsersResponse }> {
    const { totalUsers, users } = await this.masterService.getAllUsers(
      body.masterKey,
    );

    return {
      data: {
        message: 'Successfully retrieved all registered users',
        totalUsers,
        users,
        timestamp: new Date(),
      },
    };
  }

  @Post('cleardb')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all database tables and purge Cloudinary' })
  async cleardb(
    @Body() body: ClearDbRequest,
  ): Promise<{ data: ClearDbResponse }> {
    const result = await this.masterService.clearDatabase(body.masterKey);

    return {
      data: result,
    };
  }
}
