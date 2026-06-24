import { Module } from '@nestjs/common';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { BullModule } from '@nestjs/bullmq';
import { DocumentProcessor } from './processors/document.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'document-queue',
    }),
  ],
  controllers: [CourseController],
  providers: [CourseService, DocumentProcessor],
})
export class CourseModule {}
