export class DashboardResponseDto {
  success: boolean;
  message: string;
  data: AdminDashboardData | TeacherDashboardData | StudentDashboardData;
}

export interface AdminDashboardData {
  role: 'admin';
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
  attendanceTracking: any[];
}

export interface TeacherDashboardData {
  role: 'teacher';
  totalStudents: number;
  activeCourses: number;
  totalAssignments: number;
  upcomingClasses: any[];
  attendanceTracking: any[];
}

export interface StudentDashboardData {
  role: 'student';
  message: string;
}