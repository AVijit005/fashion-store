import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private bucket: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET') || 'aura-studio';
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID') || '';
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '';

    const s3Config: any = {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      // Force path style for MinIO compatibility
      forcePathStyle: !!endpoint,
    };

    if (endpoint) {
      s3Config.endpoint = endpoint;
    }

    this.s3Client = new S3Client(s3Config);
  }

  async generateUploadPresignedUrl(
    key: string,
    mimeType: string,
    expiresInSeconds: number = 300,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mimeType,
      });

      // 5 minutes by default
      return await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
    } catch (error) {
      this.logger.error(`Failed to generate upload presigned URL for key: ${key}`, error);
      throw new InternalServerErrorException('Failed to generate upload URL');
    }
  }

  async generateDownloadPresignedUrl(
    key: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      // 1 hour by default
      return await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
    } catch (error) {
      this.logger.error(`Failed to generate download presigned URL for key: ${key}`, error);
      throw new InternalServerErrorException('Failed to generate download URL');
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3Client.send(command);
    } catch (error) {
      this.logger.error(`Failed to delete object in S3: ${key}`, error);
      throw new InternalServerErrorException('Failed to delete asset from storage');
    }
  }
}
