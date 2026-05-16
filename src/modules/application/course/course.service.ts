import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AssignmentSubmissionStatus, AttachmentType, CourseStatus, EnrollmentStatus, EnrollmentStep, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import appConfig from 'src/config/app.config';
import { AttendanceService } from './attendance.helper';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';

@Injectable()
export class CourseService {
  private readonly attendanceService: AttendanceService;

  constructor(private prisma: PrismaService) {
    this.attendanceService = new AttendanceService(prisma);
  }

  async getCurrentStep(user_id: string, course_id: string) {
    if (!user_id) throw new UnauthorizedException('User not found');
    if (!course_id) throw new BadRequestException('Invalid Course Id');


    const course = await this.prisma.course.findUnique({
      where: { id: course_id, },
      select: {
        status: true,
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    if (course.status !== CourseStatus.ACTIVE) throw new BadRequestException('Course is not active');


    const enrollment = await this.prisma.enrollment.findFirst({
      where: { user_id, course_id },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        step: true,
      },
    });

    let currentStep: EnrollmentStep;
    switch (enrollment.step) {
      case EnrollmentStep.FORM_FILLING:
        currentStep = EnrollmentStep.RULES_SIGNING;
        break;
      case EnrollmentStep.RULES_SIGNING:
        currentStep = EnrollmentStep.CONTRACT_SIGNING;
        break;
      case EnrollmentStep.CONTRACT_SIGNING:
        currentStep = EnrollmentStep.PAYMENT;
        break;
      case EnrollmentStep.PAYMENT:
        currentStep = EnrollmentStep.COMPLETED;
        break;
      case EnrollmentStep.COMPLETED:
        currentStep = EnrollmentStep.COMPLETED;
        break;
      default:
        currentStep = EnrollmentStep.FORM_FILLING;
    }

    return {
      success: true,
      message: 'Enrollment step fetched successfully',
      data: {
        enrollment_id: enrollment.id,
        current_step: currentStep,
      },
    };
  }

  async enrollUser(user_id: string, course_id: string, createEnrollmentDto: CreateEnrollmentDto) {
    if (!user_id) throw new UnauthorizedException('User not found');
    if (!course_id) throw new BadRequestException('Invalid Course Id');

    const { step, rules_accepted, terms_accepted, signature_full_name, signature, signature_date, acting_goals, ...pinfo } = createEnrollmentDto;



    const existingEnrollment = await this.prisma.enrollment.findFirst({
      where: { user_id, course_id },
    })

    if (existingEnrollment && existingEnrollment.step === EnrollmentStep.COMPLETED) {
      throw new BadRequestException('User is already enrolled in the course');
    }

    if (existingEnrollment && existingEnrollment.step === EnrollmentStep.PAYMENT) {
      throw new BadRequestException('Enrollment exist , just make payment to complete enrollment');
    }

    if (step === EnrollmentStep.FORM_FILLING && !existingEnrollment) {
      const enrollment = await this.prisma.enrollment.create({
        data: {
          user_id,
          course_id,
          step: EnrollmentStep.RULES_SIGNING,
          ...pinfo,
        },
      });
      if (!enrollment) throw new InternalServerErrorException('Failed to create enrollment');
      if (acting_goals) {
        await this.prisma.user.update({
          where: { id: user_id },
          data: {
            about: acting_goals,
          },
        });
      }
    } else if (step === EnrollmentStep.RULES_SIGNING && existingEnrollment) {
      if (existingEnrollment?.step !== EnrollmentStep.RULES_SIGNING) throw new BadRequestException('Invalid step');
      if (!rules_accepted) throw new BadRequestException('Rules not accepted');
      if (!signature_date || !signature || !signature_full_name) throw new BadRequestException('Invalid signature');

      const updated = await this.prisma.enrollment.update({
        where: { id: existingEnrollment.id },
        data: {
          step: EnrollmentStep.CONTRACT_SIGNING,
          rules_regulations_accepted: true,
          rules_regulations_signature: {
            create: {
              full_name: signature_full_name,
              signature: signature,
              signed_at: new Date(signature_date),
            }
          }
        },
      });
      if (!updated) throw new InternalServerErrorException('Failed to update enrollment');
    }
    else if (step === EnrollmentStep.CONTRACT_SIGNING && existingEnrollment) {
      if (existingEnrollment?.step !== EnrollmentStep.CONTRACT_SIGNING) throw new BadRequestException('Invalid step');
      if (!terms_accepted) throw new BadRequestException('Terms not accepted');
      if (!signature_date || !signature || !signature_full_name) throw new BadRequestException('Invalid signature');

      const updated = await this.prisma.enrollment.update({
        where: { id: existingEnrollment.id },
        data: {
          step: EnrollmentStep.PAYMENT,
          digital_contract_accepted: true,
          digital_contract_signature: {
            create: {
              full_name: signature_full_name,
              signature: signature,
              signed_at: new Date(signature_date),
            }
          }
        },
      });
      if (!updated) throw new InternalServerErrorException('Failed to update enrollment');
    } else {
      throw new BadRequestException('Invalid step');
    }

    return {
      success: true,
      message: 'Submitted successfully',
    }
  }

  scanQr(token: string, userId: string) {
    return this.attendanceService.qrscanner(token, userId);
  }

  // -------------------------------------------------------------

  async getAllCourses(user_id: string, my_courses?: string) {
    if (!user_id) throw new UnauthorizedException('User not found');

    const where: Prisma.CourseWhereInput = {
    }

    if (my_courses === 'true') {
      where.enrollments = {
        some: {
          user_id: user_id,
          status: EnrollmentStatus.ACTIVE
        }
      }
    }
    else {
      where.status = CourseStatus.ACTIVE
    }

    const courses = await this.prisma.course.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        title: true,
        duration: true,
        start_date: true,
        enrollments: {
          where: {
            user_id: user_id, status: EnrollmentStatus.ACTIVE,
          }
        },
        _count: {
          select: {
            modules: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Courses fetched successfully',
      data: courses.map((course) => {
        const modules = course?._count?.modules || 0
        delete course._count;
        const enrollment = course?.enrollments?.[0]
        delete course.enrollments;
        const course_progress = Math.max(0, Math.min(100, course?.duration ? ((Date.now() - new Date(course.start_date).getTime()) / (Number(course.duration) * 86400000)) * 100 : 0));
        return {
          ...course,
          module_count: modules,
          is_enrolled: !!enrollment?.status,
          ...(my_courses && { course_progress })
        };
      })
    };
  }

  async getCourseDetails(course_id: string, user_id: string) {
    if (!user_id) throw new UnauthorizedException('User not found');
    if (!course_id) throw new BadRequestException('Invalid Course Id');

    const course = await this.prisma.course.findUnique({
      where: { id: course_id, },
      select: {
        id: true,
        title: true,
        course_overview: true,
        installment_process: true,
        rules_regulations: true,
        seat_capacity: true,
        contract: true,
        start_date: true,
        duration: true,
        class_time: true,
        status: true,
        fee_pence: true,
        instructor: {
          select: {
            id: true,
            name: true,
            avatar: true,
            experience: true
          },
        },
        modules: {
          select: {
            id: true,
            module_title: true,
            module_name: true,
          },
          orderBy: { created_at: 'asc' },
        },
        enrollments: {
          where: {
            user_id: user_id,
            status: EnrollmentStatus.ACTIVE
          },
          take: 1,
          select: {
            status: true,
          }
        }
      },
    });

    if (!course) throw new NotFoundException('Course not found');
    if (!course?.enrollments?.[0]?.status && course.status !== CourseStatus.ACTIVE) throw new BadRequestException('Course is not active');

    let nextClass = null;
    if (course?.enrollments?.[0]?.status) {
      nextClass = await this.prisma.moduleClass.findFirst({
        where: {
          module: { course_id },
          class_at: { gt: new Date() },
          end_at: null,
        },
        orderBy: { class_at: 'asc' },
        select: {
          id: true,
          class_name: true,
          class_title: true,
          class_at: true,
          duration: true,
          start_at: true,
          module: {
            select: {
              module_title: true,
              module_name: true,
            }
          }
        },
      });
      delete course.enrollments;
      delete course?.contract
      delete course?.rules_regulations
      delete course?.installment_process
      delete course?.seat_capacity
      delete course?.duration
      delete course?.class_time
    }

    delete course.status;

    return {
      success: true,
      message: 'Course details fetched successfully',
      data: {
        ...course,
        fee: course.fee_pence > 0 ? course.fee_pence / 100 : 0,
        instructor: {
          ...course.instructor,
          avatar: course.instructor?.avatar ? NajimStorage.url(course.instructor.avatar) : null,
        },
        ...(nextClass && { next_class: nextClass })
      },
    };
  }

  async getModuleDetails(module_id: string, user_id: string) {
    if (!user_id) throw new UnauthorizedException('User not found');
    if (!module_id) throw new BadRequestException('Invalid Module Id');

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        user_id: user_id,
        status: EnrollmentStatus.ACTIVE,
        course: {
          modules: {
            some: {
              id: module_id,
            },
          },
        },
      },
    });

    if (!enrollment) throw new NotFoundException('Enrollment not found');

    const moduleItem = await this.prisma.courseModule.findUnique({
      where: { id: module_id },
      select: {
        id: true,
        module_title: true,
        module_name: true,
        module_overview: true,
        course_id: true,
        classes: {
          orderBy: { class_at: 'asc' },
          select: {
            id: true,
            class_title: true,
            class_name: true,
            class_at: true,
            start_at: true,
            end_at: true,
            duration: true,
          },
        },
      },
    });

    if (!moduleItem) {
      throw new NotFoundException('Module not found');
    }

    const now = new Date();
    let nextClassFound = false;

    return {
      success: true,
      message: 'Module details fetched successfully',
      data: {
        ...moduleItem,
        classes: moduleItem.classes.map((c) => {
          const startTime = c.start_at ? new Date(c.start_at) : c.class_at ? new Date(c.class_at) : null;
          const endTime = c.end_at ? new Date(c.end_at) : startTime && c.duration ? new Date(startTime.getTime() + c.duration * 60000) : startTime;

          let status = 'UPCOMING';

          if (endTime && now > endTime) {
            status = 'COMPLETED';
          } else if (startTime && now >= startTime && endTime && now <= endTime) {
            status = 'ONGOING';
          } else if (startTime && startTime > now && !nextClassFound) {
            status = 'NEXT';
            nextClassFound = true;
          }

          return {
            ...c,
            status,
          };
        }),
      },
    };
  }

  async getClassDetails(class_id: string, user_id: string) {

    if (!user_id) throw new UnauthorizedException('User not found');
    if (!class_id) throw new BadRequestException('Invalid Class Id');

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        user_id,
        status: EnrollmentStatus.ACTIVE,
        course: {
          modules: {
            some: {
              id: class_id,
            },
          },
        },
      },
    });

    if (!enrollment) throw new NotFoundException('Enrollment not found');

    const classDetails = await this.prisma.moduleClass.findUnique({
      where: { id: class_id },
      select: {
        id: true,
        class_title: true,
        class_name: true,
        class_overview: true,
        duration: true,
        class_at: true,
        start_at: true,
        end_at: true,
        module_id: true,
      },
    });

    if (!classDetails) {
      throw new NotFoundException('Class not found');
    }

    return {
      success: true,
      message: 'Class details fetched successfully',
      data: classDetails,
    };
  }

  async getAssignmentsForCourse(course_id: string, user_id: string) {

    if (!user_id) throw new UnauthorizedException('User not found');
    if (!course_id) throw new BadRequestException('Invalid Course Id');

    const modules = await this.prisma.courseModule.findMany({
      where: { course_id: course_id },
      orderBy: { created_at: 'asc' },
      select: {
        module_title: true,
        module_name: true,
        classes: {
          orderBy: { class_at: 'asc' },
          select: {
            class_title: true,
            class_name: true,
            assignments: {
              orderBy: { created_at: 'asc' },
              select: {
                id: true,
                title: true,
                description: true,
                submission_date: true,
                total_marks: true,
                submissions: {
                  where: { student_id: user_id },
                  orderBy: { submitted_at: 'desc' },
                  take: 1,
                  select: {
                    id: true,
                    description: true,
                    submitted_at: true,
                    status: true,
                    grades: {
                      orderBy: { graded_at: 'desc' },
                      take: 1,
                      select: {
                        id: true,
                        grade: true,
                        grade_number: true,
                        feedback: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const now = new Date().getTime();

    return {
      success: true,
      message: 'Assignments fetched successfully',
      data: modules
        .map((moduleItem) => {

          return {
            ...moduleItem,
            classes: moduleItem.classes.map((classItem) => {
              return {
                ...classItem,
                assignments: classItem.assignments.map((assignment) => {
                  const submission = assignment.submissions?.[0];
                  const submissionDate = new Date(assignment.submission_date).getTime();
                  const diffInTime = submissionDate - now;
                  const due_days = Math.ceil(diffInTime / (1000 * 60 * 60 * 24));
                  delete assignment.submissions;
                  return {
                    ...assignment,
                    submission_date: assignment.submission_date.toISOString().split('T')[0],
                    status: submission.status ?? "PENDING",
                    grade_number: submission.grades?.[0].grade_number,
                    grade: submission.grades?.[0],
                    due_days: due_days > 0 ? due_days : null,
                  };
                }),
              };
            }),
          }
        })
        .filter((moduleItem) => moduleItem.classes.some(cls => cls.assignments.length > 0)),
    };
  }

  async getAssignmentDetails(assignment_id: string, user_id: string) {
    if (!user_id) throw new UnauthorizedException('User not found');
    if (!assignment_id) throw new BadRequestException('Invalid Assignment Id');

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        user_id: user_id,
        status: EnrollmentStatus.ACTIVE,
        course: {
          modules: {
            some: {
              classes: {
                some: {
                  assignments: {
                    some: {
                      id: assignment_id,
                    },
                  },
                },
              },
            },
          },
        },
      },
      select: {
        id: true
      }
    });

    if (!enrollment) throw new NotFoundException('Enrollment not found');

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignment_id },
      select: {
        id: true,
        title: true,
        description: true,
        submission_date: true,
        total_marks: true,
        attachments: {
          select: {
            file_name: true,
            file_path: true,
            mime_type: true,
          },
        },
        class: {
          select: {
            class_title: true,
            class_name: true,
            module: {
              select: {
                module_title: true,
                module_name: true,
              },
            },
          },
        },
        submissions: {
          where: { student_id: user_id },
          orderBy: { submitted_at: 'desc' },
          take: 1,
          select: {
            description: true,
            submitted_at: true,
            status: true,
            attachments: {
              select: {
                file_name: true,
                file_path: true,
                mime_type: true,
              },
            },
            grades: {
              orderBy: { graded_at: 'desc' },
              take: 1,
              select: {
                grade: true,
                grade_number: true,
                feedback: true,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    const submission = assignment.submissions[0] ?? null;
    const grade = submission?.grades[0] ?? null;

    const now = new Date().getTime();
    const submissionDate = new Date(assignment.submission_date).getTime();
    const diffInTime = submissionDate - now;
    const due_days = Math.ceil(diffInTime / (1000 * 60 * 60 * 24));

    const classModule = assignment?.class?.module;
    delete assignment?.class.module;

    return {
      success: true,
      message: 'Assignment details fetched successfully',
      data: {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        submission_date: assignment.submission_date,
        total_marks: assignment.total_marks,
        attachments: assignment.attachments.map((attachment) => {
          return {
            file_name: attachment.file_name,
            file_path: attachment.file_path ? NajimStorage.url(attachment.file_path) : null,
            mime_type: attachment.mime_type,
          }
        }),
        class: assignment.class,
        module: classModule,
        status: submission?.status ?? "PENDING",
        due_days: due_days > 0 ? due_days : null,
        submitted_at: submission?.submitted_at,
        submission: submission
          ? {
            ...submission,
            attachments: submission.attachments.map((attachment) => {
              return {
                file_name: attachment.file_name,
                file_path: attachment.file_path ? NajimStorage.url(attachment.file_path) : null,
                mime_type: attachment.mime_type,
              }
            }),
            grade,
          }
          : null,
      },
    };
  }

  async submitAssignment(
    assignment_id: string,
    user_id: string,
    submitAssignmentDto: SubmitAssignmentDto,
    files: Express.Multer.File[],
  ) {

    if (!user_id) throw new UnauthorizedException('User not found');
    if (!assignment_id) throw new BadRequestException('Invalid Assignment Id');


    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignment_id },
      select: {
        id: true,
        class: {
          select: {
            module: {
              select: {
                course_id: true,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        user_id: user_id,
        status: EnrollmentStatus.ACTIVE,
        course_id: assignment.class.module.course_id,
      },
      select: {
        id: true
      }
    });

    if (!enrollment) throw new NotFoundException('Enrollment not found');

    const existingSubmission = await this.prisma.assignmentSubmission.findFirst({
      where: {
        assignment_id: assignment_id,
        student_id: user_id,
      },
      select: {
        id: true,
      },
    });

    if (existingSubmission) {
      throw new ConflictException('Assignment already submitted');
    }

    const attachments: Prisma.AttachmentCreateInput[] = [];

    for (const file of files) {
      const filename = NajimStorage.generateFileName(file.originalname)
      const objectKey = appConfig().storageUrl.assignment + '/' + filename
      await NajimStorage.put(objectKey, file)
      attachments.push({
        file_name: filename,
        file_path: objectKey,
        mime_type: file.mimetype,
        type: AttachmentType.FILE
      })
    }


    const submission = await this.prisma.assignmentSubmission.create({
      data: {
        assignment: {
          connect: { id: assignment_id },
        },
        student: {
          connect: { id: user_id },
        },
        description: submitAssignmentDto?.description,
        status: AssignmentSubmissionStatus.SUBMITTED,
        attachments: attachments.length
          ? {
            create: attachments,
          }
          : undefined,
      }
    });

    if (!submission) throw new InternalServerErrorException('Failed to submit assignment');

    return {
      success: true,
      message: 'Assignment submitted successfully',
    };
  }

  async getAssignmentsForClass(user_id: string, class_id: string) {

    if (!user_id) throw new UnauthorizedException('User not found');
    if (!class_id) throw new BadRequestException('Invalid Class Id');

    const moduleClass = await this.prisma.moduleClass.findUnique({
      where: { id: class_id },
      select: {
        id: true,
        module: {
          select: {
            course_id: true,
          },
        },
      },
    });

    if (!moduleClass) {
      throw new NotFoundException('Class not found');
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        user_id: user_id,
        status: EnrollmentStatus.ACTIVE,
        course_id: moduleClass.module.course_id,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!enrollment) throw new NotFoundException('Enrollment not found');


    const assignments = await this.prisma.assignment.findMany({
      where: { class_id: class_id },
      orderBy: { submission_date: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        submission_date: true,
        total_marks: true,
        submissions: {
          where: { student_id: user_id },
          orderBy: { submitted_at: 'desc' },
          take: 1,
          select: {
            id: true,
            description: true,
            submitted_at: true,
            status: true,
            grades: {
              orderBy: { graded_at: 'desc' },
              take: 1,
              select: {
                id: true,
                grade: true,
                grade_number: true,
                feedback: true,
              },
            },
          },
        },
      },
    });

    const now = new Date().getTime();

    return {
      success: true,
      message: 'Assignments retrieved successfully',
      data: assignments.map((assignment) => {
        const submission = assignment.submissions?.[0];
        const submissionDate = new Date(assignment.submission_date).getTime();
        const diffInTime = submissionDate - now;
        const due_days = Math.ceil(diffInTime / (1000 * 60 * 60 * 24));
        delete assignment.submissions;
        return {
          ...assignment,
          submission_date: assignment.submission_date.toISOString().split('T')[0],
          status: submission.status ?? "PENDING",
          grade_number: submission.grades?.[0].grade_number,
          grade: submission.grades?.[0],
          due_days: due_days > 0 ? due_days : null,
        };

      }),
    };
  }

  async getAllAssetsFromCourse(course_id: string, user_id: string, type?: "VIDEO" | 'FILE') {
    if (!user_id) throw new BadRequestException('You must be logged in to access this feature');
    if (!course_id) throw new BadRequestException('Invalid Course Id');

    const where: Prisma.CourseModuleWhereInput = {
      course_id: course_id,
    }

    if (type !== 'VIDEO') {
      where.classes = {
        some: {
          class_assets: {
            none: {
              type: AttachmentType.VIDEO
            }
          }
        }
      }
    }

    const modules = await this.prisma.courseModule.findMany({
      where,
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        module_title: true,
        module_name: true,
        classes: {
          orderBy: { class_at: 'asc' },
          select: {
            id: true,
            class_title: true,
            class_name: true,
            class_assets: {
              select: {
                id: true,
                type: true,
                file_name: true,
                file_path: true,
                mime_type: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      message: 'Course assets fetched successfully',
      data:
        modules.map((moduleItem) => ({
          ...moduleItem,
          classes: moduleItem.classes.map((classItem) => ({
            ...classItem,
            class_assets: classItem?.class_assets?.map((asset) => ({
              ...asset,
              file_path: asset.file_path ? NajimStorage.url(asset.file_path) : null
            })) ?? [],
          })),
        })),
    };
  }


  async getAllAssets(class_id: string, user_id: string) {

    if (!user_id) throw new BadRequestException('You must be logged in to access this feature');
    if (!class_id) throw new BadRequestException('Invalid Course Id');

    const moduleClass = await this.prisma.moduleClass.findUnique({
      where: { id: class_id },
      select: {
        id: true,
        module: {
          select: {
            course_id: true,
          },
        },
      },
    });

    if (!moduleClass) throw new NotFoundException('Class not found');

    const assets = await this.prisma.attachment.findMany({
      where: { class_id: class_id },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        type: true,
        file_name: true,
        file_path: true,
        mime_type: true,
      },
    });

    return {
      success: true,
      message: 'Class assets fetched successfully',
      data: {
        videos: assets?.flatMap((asset) => {
          if (asset.type === AttachmentType.VIDEO) {
            return {
              ...asset,
              file_path: asset.file_path ? NajimStorage.url(asset.file_path) : null
            }
          }
        }) ?? [],
        files: assets?.flatMap((asset) => {
          if (asset.type !== AttachmentType.VIDEO) {
            return {
              ...asset,
              file_path: asset.file_path ? NajimStorage.url(asset.file_path) : null
            }
          }
        }) ?? [],
      }
    };
  }

  // --------------------------------------------------
}
