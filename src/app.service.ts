import { Injectable } from '@nestjs/common';
import { NajimStorage } from './common/lib/Disk/NajimStorage';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello world';
  }

  async test(image: Express.Multer.File) {
    try {
      const fileName = image.originalname;
      const fileType = image.mimetype;
      const fileSize = image.size;
      const fileBuffer = image.buffer;

      const result = await NajimStorage.put(fileName, fileBuffer);

      return {
        success: true,
        message: 'Image uploaded successfully',
        data: result,
        url: NajimStorage.url('tony1.jpg'),
      };
    } catch (error) {
      throw new Error(`Failed to upload image: ${error}`);
    }
  }
}
