import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class CustomExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CustomExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        message = (res as any).message || exception.message;
        error = (res as any).error || undefined;
      } else {
        message = typeof res === 'string' ? res : exception.message;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled Exception: ${exception.message}`,
        exception.stack,
      );
      message = exception.message;
      error = exception.name !== 'Error' ? exception.name : undefined;
    } else {
      this.logger.error(`Unknown Exception: ${String(exception)}`);
      message = typeof exception === 'string' ? exception : 'An unexpected error occurred';
    }

    const responseBody: any = {
      success: false,
      message: Array.isArray(message) ? message.join(', ') : message,
    };

    if (error !== undefined && error !== null) {
      responseBody.error = error;
    }

    response.status(status).json(responseBody);
  }
}
