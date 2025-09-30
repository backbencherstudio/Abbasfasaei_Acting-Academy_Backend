
export interface MetricResult {
  current: number;
  previous: number;
  percentageChange: number;
}

export interface DashboardResponse {
  role: string;
  totalStudents: MetricResult;
  totalOngoingCourses: MetricResult;
  monthlyRevenue: MetricResult;
  totalTeachers: MetricResult;
  recentEnrollments: any[];
  upcomingClasses: any[];
  attendanceTracking: any[];
}