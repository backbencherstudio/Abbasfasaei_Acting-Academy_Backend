export class AdminDashboardDto {
  totalStudents: {
    current: number;
    previous: number;
    percentageChange: number;
  };
  totalOngoingCourses: {
    current: number;
    previous: number;
    percentageChange: number;
  };
  monthlyRevenue: {
    current: number;
    previous: number;
    percentageChange: number;
  };
  totalTeachers: {
    current: number;
    previous: number;
    percentageChange: number;
  };
  recentEnrollments: any[];
  upcomingClasses: any[];
  attendanceTracking: {
    totalClasses: number;
    completedClasses: number;
    totalStudents: number;
    averageAttendance: number;
  };
}