import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TransactionService } from './transaction.service';

@Processor('installment-access-queue')
export class InstallmentAccessProcessor extends WorkerHost {
  private readonly logger = new Logger(InstallmentAccessProcessor.name);

  constructor(private readonly transactionService: TransactionService) {
    super();
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: any) {
    this.logger.log(
      `Job ${job.name} completed. Suspended enrollments: ${result?.updated ?? 0}`,
    );
  }

  async process(job: Job): Promise<any> {
    if (job.name !== 'suspendOverdueInstallments') {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return;
    }

    return this.transactionService.suspendOverdueInstallmentAccess();
  }
}
