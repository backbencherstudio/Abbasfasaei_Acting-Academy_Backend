// import { Controller, Get, Param, UseGuards } from '@nestjs/common';
// import { PresenceService } from './presence.service';
// import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';


// @UseGuards(JwtAuthGuard)
// @Controller('presence')
// export class PresenceController {
//   constructor(private presence: PresenceService) {}

//   @Get(':userId')
//   me(@Param('userId') userId: string) {
//     return this.presence.getPresence(userId);
//   }

//   @Get('conversation/:id')
//   conv(@Param('id') id: string) {
//     return this.presence.presenceForConversation(id);
//   }
// }
