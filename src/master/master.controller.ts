import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ClearDbRequest, ClearDbResponse } from './dto/cleardb.dto';
import { GetAllUsersRequest, GetAllUsersResponse } from './dto/getallusers.dto';
import { MasterService } from './master.service';

@Controller('master')
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  @Post('cleardb')
  @HttpCode(HttpStatus.OK)
  async cleardb(@Body() body: ClearDbRequest): Promise<ClearDbResponse> {
    return this.masterService.cleardb(body.masterKey);
  }

  @Post('getallusers')
  @HttpCode(HttpStatus.OK)
  async getAllUsers(
    @Body() body: GetAllUsersRequest,
  ): Promise<GetAllUsersResponse> {
    return this.masterService.getAllUsers(body.masterKey);
  }
}
