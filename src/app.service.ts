import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hey, you found me! 🤖✨ I am NEXA, alive and ready to help. The server is running smoothly, head to /api for the goodies. 🚀💚';
  }
}
