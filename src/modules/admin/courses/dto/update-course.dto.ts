import { PartialType } from '@nestjs/swagger';
import { CreateCourseDto } from './create-course.dto';

export class UpdateCourseDto extends PartialType(CreateCourseDto) {
    title?: string;
    instructorId?: string;
    fee?: number;
    duration?: string;
    class_time?: string;
    start_date?: string;
    seat_capacity?: string;
    
}
