export class TeacherDashboardDto {
  totalStudents: number;
  activeCourses: any[];
  activeAssignments: any[];
  completionRate: number;
  upcomingClasses: any[];
  attendanceTracking: {
    totalClasses: number;
    completedClasses: number;
    totalStudents: number;
    averageAttendance: number;
  };
}