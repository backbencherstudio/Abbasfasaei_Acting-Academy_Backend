import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';

@Catch(HttpException)
export class CustomExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status = exception.getStatus();

    // Return custom error response format
    response.status(status).json({
      success: false,
      message: (exception.getResponse() as any).message || exception.message,
      error: (exception.getResponse() as any).error || exception.getResponse(),
    });
  }
}
