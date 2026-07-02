import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AssetsController } from './assets.controller';
import { StorageService } from './storage.service';
import { PrismaService } from '../../config/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('AssetsController', () => {
  let controller: AssetsController;
  let storageService: jest.Mocked<StorageService>;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-123',
    role: 'USER',
  };

  const mockRequest = {
    user: mockUser,
  } as any;

  beforeEach(async () => {
    const mockStorageService = {
      generateUploadPresignedUrl: jest.fn().mockResolvedValue('https://presigned-url.test'),
      getObjectMetadata: jest.fn(),
      generateDownloadPresignedUrl: jest.fn(),
      deleteObject: jest.fn(),
    };

    const mockPrismaService = {
      asset: {
        create: jest.fn().mockImplementation((args: any) =>
          Promise.resolve({
            id: 'asset-123',
            ...args.data,
            status: 'PENDING',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'AWS_S3_BUCKET') return 'aura-studio';
        if (key === 'AWS_REGION') return 'us-east-1';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetsController],
      providers: [
        { provide: StorageService, useValue: mockStorageService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AssetsController>(AssetsController);
    storageService = module.get(StorageService);
    prismaService = module.get(PrismaService);
  });

  describe('requestUploadUrl', () => {
    it('should return 400 for disallowed mimeType text/html', async () => {
      await expect(
        controller.requestUploadUrl(mockRequest, {
          filename: 'evil.html',
          mimeType: 'text/html',
          size: 1024,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(storageService.generateUploadPresignedUrl).not.toHaveBeenCalled();
    });

    it('should succeed for allowed mimeType image/png and return a storage key ending in .png', async () => {
      const result = await controller.requestUploadUrl(mockRequest, {
        filename: 'good.png',
        mimeType: 'image/png',
        size: 1024,
      } as any);

      expect(result.asset.storageKey).toMatch(/^assets\/user-123\/[0-9a-f-]+\.png$/);
      expect(result.asset.filename).toBe('good.png');
      expect(storageService.generateUploadPresignedUrl).toHaveBeenCalledWith(
        result.asset.storageKey,
        'image/png',
      );
    });

    it('should return 400 for filename containing a forward slash path separator', async () => {
      await expect(
        controller.requestUploadUrl(mockRequest, {
          filename: '../evil.png',
          mimeType: 'image/png',
          size: 1024,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(storageService.generateUploadPresignedUrl).not.toHaveBeenCalled();
    });

    it('should return 400 for filename containing a backslash path separator', async () => {
      await expect(
        controller.requestUploadUrl(mockRequest, {
          filename: '..\\evil.png',
          mimeType: 'image/png',
          size: 1024,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(storageService.generateUploadPresignedUrl).not.toHaveBeenCalled();
    });

    it('should return 400 for empty filename', async () => {
      await expect(
        controller.requestUploadUrl(mockRequest, {
          filename: '',
          mimeType: 'image/png',
          size: 1024,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(storageService.generateUploadPresignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('confirmUpload', () => {
    it('should reject when S3 ContentType is not in the MIME allowlist', async () => {
      prismaService.asset.findUnique = jest.fn().mockResolvedValue({
        id: 'asset-123',
        userId: 'user-123',
        mimeType: 'text/html',
        storageKey: 'assets/user-123/asset-123.html',
        status: 'PENDING',
      });

      storageService.getObjectMetadata = jest.fn().mockResolvedValue({
        ContentLength: 1024,
        ContentType: 'text/html',
      });

      await expect(
        controller.confirmUpload(mockRequest, 'asset-123'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.asset.update).toHaveBeenCalledWith({
        where: { id: 'asset-123' },
        data: { status: 'FAILED' },
      });
    });
  });
});
