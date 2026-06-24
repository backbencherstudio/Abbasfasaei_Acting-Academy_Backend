import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, InternalServerErrorException } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import appConfig from 'src/config/app.config';
import * as puppeteer from 'puppeteer';
import { AttachmentType } from '@prisma/client';

export interface DocumentJobPayload {
  enrollmentId: string;
  documentType: 'rules' | 'contract';
}

@Processor('document-queue')
export class DocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<DocumentJobPayload>): Promise<any> {
    const { enrollmentId, documentType } = job.data;
    this.logger.log(
      `Processing document generation for enrollment ${enrollmentId}, type: ${documentType}`,
    );

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        course: true,
        digital_contract_signature: true,
        rules_regulations_signature: true,
      },
    });

    if (!enrollment) {
      throw new Error(`Enrollment ${enrollmentId} not found`);
    }

    const signature =
      documentType === 'rules'
        ? enrollment.rules_regulations_signature
        : enrollment.digital_contract_signature;

    if (!signature) {
      throw new Error(
        `Signature not found for enrollment ${enrollmentId}, type: ${documentType}`,
      );
    }

    const documentTitle =
      documentType === 'rules'
        ? 'Rules & Regulations Agreement'
        : 'Digital Enrollment Contract';

    const courseTitle = enrollment.course?.title || 'Unknown Course';
    const content =
      documentType === 'rules'
        ? enrollment.course?.rules_regulations || 'No rules regulations defined.'
        : enrollment.course?.contract || 'No digital contract terms defined.';

    const htmlContent = this.generateHtml(
      documentTitle,
      courseTitle,
      content,
      enrollment,
      signature,
    );

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent);
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
      });

      const fileName = `enrolled_document_${enrollmentId}_${documentType}_${Date.now()}.pdf`;
      const objectKey = `${appConfig().storageUrl.media}/${fileName}`;

      await NajimStorage.put(objectKey, pdfBuffer, {
        contentType: 'application/pdf',
      });

      const targetType =
        documentType === 'rules'
          ? AttachmentType.RULES_REGULATIONS
          : AttachmentType.DIGITAL_CONTRACT;

      const existingAttachment = await this.prisma.attachment.findFirst({
        where: {
          enrollment_id: enrollmentId,
          type: targetType,
        },
      });

      if (existingAttachment) {
        await this.prisma.attachment.update({
          where: { id: existingAttachment.id },
          data: {
            file_name: fileName,
            file_path: objectKey,
            size_bytes: BigInt(pdfBuffer.length),
          },
        });

        try {
          await NajimStorage.delete(existingAttachment.file_path);
        } catch (err) {
          this.logger.warn(
            `Could not delete old file: ${existingAttachment.file_path}`,
          );
        }
      } else {
        await this.prisma.attachment.create({
          data: {
            enrollment_id: enrollmentId,
            type: targetType,
            file_name: fileName,
            file_path: objectKey,
            mime_type: 'application/pdf',
            size_bytes: BigInt(pdfBuffer.length),
          },
        });
      }

      this.logger.log(
        `Successfully generated and saved ${documentType} document: ${fileName}`,
      );
      return { success: true, fileName };
    } catch (error) {
      this.logger.error(`Error generating document: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to generate document: ${error.message}`,
      );
    } finally {
      await browser.close();
    }
  }

  private generateHtml(
    documentTitle: string,
    courseTitle: string,
    content: string,
    enrollment: any,
    signature: any,
  ): string {
    const isImageSignature = signature.signature?.startsWith('data:image/');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${documentTitle}</title>
  <style>
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: #333333;
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }
    .container {
      padding: 40px;
    }
    .header {
      border-bottom: 2px solid #eaeaea;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      color: #111111;
      margin: 0;
    }
    .subtitle {
      font-size: 14px;
      color: #666666;
      margin-top: 5px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #111111;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-left: 3px solid #111111;
      padding-left: 8px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .info-item {
      font-size: 14px;
    }
    .info-label {
      font-weight: 600;
      color: #666666;
    }
    .content-box {
      border: 1px solid #eaeaea;
      padding: 20px;
      background-color: #fafafa;
      border-radius: 6px;
      font-size: 14px;
      white-space: pre-wrap;
    }
    .signature-area {
      margin-top: 50px;
      border-top: 1px solid #eaeaea;
      padding-top: 30px;
      page-break-inside: avoid;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 50px;
    }
    .signature-block {
      border: 1px dashed #cccccc;
      padding: 20px;
      border-radius: 6px;
      background-color: #fcfcfc;
      min-height: 150px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .signature-title {
      font-size: 11px;
      font-weight: 600;
      color: #999999;
      margin-bottom: 15px;
      text-transform: uppercase;
    }
    .signature-name {
      font-size: 16px;
      font-weight: 600;
      color: #111111;
    }
    .signature-date {
      font-size: 12px;
      color: #666666;
      margin-top: 5px;
    }
    .signature-content {
      flex-grow: 1;
      display: flex;
      align-items: center;
      margin-top: 10px;
      margin-bottom: 10px;
    }
    .signature-image {
      max-height: 50px;
      max-width: 200px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">${documentTitle}</h1>
      <p class="subtitle">Course: ${courseTitle}</p>
    </div>
    
    <div class="section">
      <h2 class="section-title">Student Information</h2>
      <div class="grid">
        <div class="info-item"><span class="info-label">Full Name:</span> ${enrollment.name}</div>
        <div class="info-item"><span class="info-label">Email:</span> ${enrollment.email}</div>
        <div class="info-item"><span class="info-label">Phone:</span> ${enrollment.phone}</div>
        <div class="info-item"><span class="info-label">Date of Birth:</span> ${new Date(enrollment.date_of_birth).toLocaleDateString()}</div>
        <div class="info-item"><span class="info-label">Address:</span> ${enrollment.address}</div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Agreement & Terms</h2>
      <div class="content-box">${content}</div>
    </div>

    <div class="signature-area">
      <div class="signature-grid">
        <div class="signature-block">
          <div>
            <div class="signature-title">Student Signature</div>
            <div class="signature-name">${signature.full_name}</div>
          </div>
          <div class="signature-content">
            ${
              isImageSignature
                ? `<img class="signature-image" src="${signature.signature}" alt="Student Signature" />`
                : `<div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 24px; color: #1a4d80; font-style: italic;">${signature.signature}</div>`
            }
          </div>
          <div class="signature-date">Signed Date: ${new Date(signature.signed_at).toLocaleDateString()}</div>
        </div>
        <div class="signature-block">
          <div>
            <div class="signature-title">Academy Representative</div>
            <div class="signature-name">Abbas Fasaei Acting Academy</div>
          </div>
          <div class="signature-content">
            <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 24px; color: #111111; opacity: 0.6; font-style: italic;">Authorized Signatory</div>
          </div>
          <div class="signature-date">Date: ${new Date(signature.signed_at).toLocaleDateString()}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }
}
