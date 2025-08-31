import type { Express } from 'express';
import { Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED = [
  'image/png','image/jpeg','image/webp','image/gif',
  'application/pdf','text/plain',
  'audio/mpeg','video/mp4'
];

function filename(_, file, cb) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  cb(null, id + extname(file.originalname));
}
function fileFilter(_, file, cb) {
  if (ALLOWED.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Unsupported file type'), false);
}

@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({ destination: 'uploads', filename }),
    limits: { fileSize: MAX_SIZE },
    fileFilter,
  }))
  upload(@UploadedFile() file: Express.Multer.File) {
    return {
      url: `/uploads/${file.filename}`,
      name: file.originalname,
      size: file.size,
      mime: file.mimetype,
    };
  }
}
