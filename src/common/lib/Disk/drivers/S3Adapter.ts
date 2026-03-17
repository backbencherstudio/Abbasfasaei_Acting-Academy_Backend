import * as AWS from 'aws-sdk';
import { extname } from 'path';
import { IStorage } from './iStorage';
import { DiskOption } from '../Option';

const MIME_MAP: Record<string, string> = {
  // Video
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
  // Image
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  // Document
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx':
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.zip': 'application/zip',
};

function mimeFromKey(key: string): string {
  return MIME_MAP[extname(key).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * S3Adapter for s3 bucket storage
 */
export class S3Adapter implements IStorage {
  private _config: DiskOption;
  private s3: AWS.S3;
  private bucketEnsured = false;

  constructor(config: DiskOption) {
    this._config = config;
    const awsConfig: AWS.S3.ClientConfiguration = {
      endpoint: this._config.connection.awsEndpoint,
      region: this._config.connection.awsDefaultRegion,
      credentials: {
        accessKeyId: this._config.connection.awsAccessKeyId,
        secretAccessKey: this._config.connection.awsSecretAccessKey,
      },
    };
    if (this._config.connection.minio) {
      // s3ForcePathStyle: true, // Required for MinIO
      awsConfig['s3ForcePathStyle'] = true;
    }
    this.s3 = new AWS.S3({
      ...awsConfig,
    });
  }

  /**
   * returns object url
   *
   * https://[bucketname].s3.[region].amazonaws.com/[object]
   * and for minio
   * http://[endpoint]/[bucketname]/[object]
   * @param key
   * @returns
   */

  url(key: string): string {
    if (this._config.connection.minio) {
      return `${this._config.connection.awsEndpoint}/${this._config.connection.awsBucket}/${key}`;
    }
    return `https://${this._config.connection.awsBucket}.s3.${this._config.connection.awsDefaultRegion}.amazonaws.com/${key}`;
  }

  /**
   * check if file exists
   * @param key
   * @returns
   */
  async isExists(key: string): Promise<boolean> {
    try {
      const params = { Bucket: this._config.connection.awsBucket, Key: key };
      await this.s3.headObject(params).promise();
      return true;
    } catch (error) {
      if ((error as AWS.AWSError).code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * get data
   * @param key
   */
  async get(key: string) {
    try {
      const params = { Bucket: this._config.connection.awsBucket, Key: key };
      const data = this.s3.getObject(params).createReadStream();
      return data;
    } catch (error) {
      throw new Error(`Failed to get object ${key}: ${error}`);
    }
  }

  /**
   * put data
   * @param key
   * @param value
   */
  async put(
    key: string,
    value: Buffer | Uint8Array | string,
    options?: { contentType?: string; contentDisposition?: string },
  ): Promise<AWS.S3.ManagedUpload.SendData> {
    const contentType = options?.contentType ?? mimeFromKey(key);
    const contentDisposition = options?.contentDisposition ?? 'inline';
    const params = {
      Bucket: this._config.connection.awsBucket,
      Key: key,
      Body: value,
      ContentType: contentType,
      ContentDisposition: contentDisposition,
    };

    try {
      const upload = await this.s3.upload(params).promise();
      return upload;
    } catch (error) {
      const awsError = error as AWS.AWSError;
      if (
        (awsError?.code === 'NoSuchBucket' || awsError?.code === 'NotFound') &&
        !this.bucketEnsured
      ) {
        await this.s3
          .createBucket({ Bucket: this._config.connection.awsBucket })
          .promise();
        this.bucketEnsured = true;
        return this.s3.upload(params).promise();
      }
      throw error;
    }
  }

  /**
   * delete data
   * @param key
   */
  async delete(key: string): Promise<boolean> {
    try {
      const params = { Bucket: this._config.connection.awsBucket, Key: key };
      await this.s3.deleteObject(params).promise();
      return true;
    } catch (error) {
      if ((error as AWS.AWSError).code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
}
