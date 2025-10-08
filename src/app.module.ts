// external imports
import { MiddlewareConsumer, Module } from '@nestjs/common';
// import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
// import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from '@nestjs-modules/ioredis';

// internal imports
import appConfig from './config/app.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
// import { ThrottlerBehindProxyGuard } from './common/guard/throttler-behind-proxy.guard';
import { AbilityModule } from './ability/ability.module';
import { MailModule } from './mail/mail.module';
import { ApplicationModule } from './modules/application/application.module';
import { AdminModule } from './modules/admin/admin.module';
import { PaymentModule } from './modules/payment/payment.module';
// import { PaymentModule } from './modules/payment/payment.module';
// import { PresenceModule } from './modules/chat/presence/presence.module';
import { UploadsModule } from './modules/chat/uploads/uploads.module';
import { MessagesModule } from './modules/chat/messages/messages.module';
import { ConversationsModule } from './modules/chat/conversations/conversations.module';
import { RealtimeModule } from './modules/chat/realtime/realtime.module';
import { CommunityModule } from './modules/community/community.module';
import { EnrollmentModule } from './modules/enrollment/enrollment.module';
import { CoursesModule } from './modules/admin/courses/courses.module';
import { StudentManagementModule } from './modules/admin/student-management/student-management.module';
import { InstructorsModule } from './modules/admin/instructors/instructors.module';
import { CourseModule } from './modules/course/course.module';
import { HomeModule } from './modules/home/home.module';
import { RtcModule } from './modules/chat/rtc/rtc.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    BullModule.forRoot({
      connection: {
        host: appConfig().redis.host,
        password: appConfig().redis.password,
        port: +appConfig().redis.port,
      },
      // redis: {
      //   host: appConfig().redis.host,
      //   password: appConfig().redis.password,
      //   port: +appConfig().redis.port,
      // },
    }),
    RedisModule.forRoot({
      type: 'single',
      options: {
        host: appConfig().redis.host,
        password: appConfig().redis.password,
        port: +appConfig().redis.port,
      },
    }),
    // disabling throttling for dev
    // ThrottlerModule.forRoot([
    //   {
    //     name: 'short',
    //     ttl: 1000,
    //     limit: 3,
    //   },
    //   {
    //     name: 'medium',
    //     ttl: 10000,
    //     limit: 20,
    //   },
    //   {
    //     name: 'long',
    //     ttl: 60000,
    //     limit: 100,
    //   },
    // ]),
    // General modules
    PrismaModule,
    AuthModule,
    AbilityModule,
    MailModule,
    ApplicationModule,
    AdminModule,
    RealtimeModule,
    ConversationsModule,
    MessagesModule,
    UploadsModule,
  // PresenceModule,
  PaymentModule,
    CommunityModule,
    EnrollmentModule,
    CoursesModule,
    CourseModule,
    StudentManagementModule,
    InstructorsModule,
    HomeModule,
    RtcModule,
  ],
  controllers: [AppController],
  providers: [
    // disabling throttling for dev
    // {
    //   provide: APP_GUARD,
    //   useClass: ThrottlerGuard,
    // },
    // disbling throttling for dev {
    //   provide: APP_GUARD,
    //   useClass: ThrottlerBehindProxyGuard,
    // },
    AppService,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
