export class CreateClassDto {
  class_title: string;
  class_name: string;
  class_overview?: string;
  duration: string;
  start_date: Date;
  class_time: string; 
  moduleId: string;
}
