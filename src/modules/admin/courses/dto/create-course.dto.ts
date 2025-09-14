export class CreateCourseDto {
  title: string;
  course_overview?: any;
  course_module_details?: any;
  duration: string;
  class_time: string;
  start_date: string;
  fee: number;
  installment_process?: any;
  instructorId: string;
  seat_capacity: string;
}
