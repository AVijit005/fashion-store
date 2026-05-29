import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/config/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DesignStatus, SubmissionStatus, TemplateStatus, AssetStatus } from '@prisma/client';
import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';

describe('Studio Ecosystem (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let customerToken: string;
  let customer2Token: string; // for ownership checks
  let adminToken: string;
  let creatorToken: string;
  let customerId: string;
  let customer2Id: string;
  let creatorId: string;
  let bucketName: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    configService = app.get<ConfigService>(ConfigService);

    bucketName = configService.get<string>('AWS_S3_BUCKET') || 'aura-studio';

    // Ensure S3 bucket is created in local MinIO container
    const s3Client = new S3Client({
      region: configService.get<string>('AWS_REGION') || 'us-east-1',
      credentials: {
        accessKeyId: configService.get<string>('AWS_ACCESS_KEY_ID') || 'aura_admin',
        secretAccessKey: configService.get<string>('AWS_SECRET_ACCESS_KEY') || 'aura_password',
      },
      endpoint: configService.get<string>('AWS_S3_ENDPOINT') || 'http://localhost:9000',
      forcePathStyle: true,
    });
    try {
      await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
    } catch (e) {
      // Ignore if it already exists
    }

    // Setup test users (pre-cleanup to ensure clean slate)
    const existingUsers = await prisma.user.findMany({
      where: {
        email: {
          in: [
            'studio.customer@example.com',
            'studio.customer2@example.com',
            'studio.admin@example.com',
            'studio.creator@example.com',
          ],
        },
      },
    });
    const existingUserIds = existingUsers.map((u) => u.id);
    if (existingUserIds.length > 0) {
      await prisma.creatorTemplate.deleteMany({
        where: { userId: { in: existingUserIds } },
      });
      await prisma.studioSubmission.deleteMany({
        where: { design: { userId: { in: existingUserIds } } },
      });
      await prisma.designVersion.deleteMany({
        where: { design: { userId: { in: existingUserIds } } },
      });
      await prisma.studioDesign.deleteMany({
        where: { userId: { in: existingUserIds } },
      });
      await prisma.asset.deleteMany({
        where: { userId: { in: existingUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: existingUserIds } },
      });
    }

    const customer = await prisma.user.create({
      data: {
        email: 'studio.customer@example.com',
        passwordHash: 'hash',
        role: 'CUSTOMER',
        isVerified: true,
      },
    });
    customerId = customer.id;

    const customer2 = await prisma.user.create({
      data: {
        email: 'studio.customer2@example.com',
        passwordHash: 'hash',
        role: 'CUSTOMER',
        isVerified: true,
      },
    });
    customer2Id = customer2.id;

    const admin = await prisma.user.create({
      data: {
        email: 'studio.admin@example.com',
        passwordHash: 'hash',
        role: 'ADMIN',
        isVerified: true,
      },
    });

    const creator = await prisma.user.create({
      data: {
        email: 'studio.creator@example.com',
        passwordHash: 'hash',
        role: 'CREATOR',
        isVerified: true,
      },
    });
    creatorId = creator.id;

    // Generate tokens directly using the application's JWT secret
    const secret = configService.get<string>('JWT_SECRET');
    customerToken = await jwtService.signAsync(
      { sub: customer.id, role: customer.role },
      { secret },
    );
    customer2Token = await jwtService.signAsync(
      { sub: customer2.id, role: customer2.role },
      { secret },
    );
    adminToken = await jwtService.signAsync({ sub: admin.id, role: admin.role }, { secret });
    creatorToken = await jwtService.signAsync({ sub: creator.id, role: creator.role }, { secret });
  });
  afterAll(async () => {
    if (prisma) {
      const existingUsers = await prisma.user.findMany({
        where: {
          email: {
            in: [
              'studio.customer@example.com',
              'studio.customer2@example.com',
              'studio.admin@example.com',
              'studio.creator@example.com',
            ],
          },
        },
      });
      const existingUserIds = existingUsers.map((u) => u.id);
      if (existingUserIds.length > 0) {
        await prisma.creatorTemplate.deleteMany({
          where: { userId: { in: existingUserIds } },
        });
        await prisma.studioSubmission.deleteMany({
          where: { design: { userId: { in: existingUserIds } } },
        });
        await prisma.designVersion.deleteMany({
          where: { design: { userId: { in: existingUserIds } } },
        });
        await prisma.studioDesign.deleteMany({
          where: { userId: { in: existingUserIds } },
        });
        await prisma.asset.deleteMany({
          where: { userId: { in: existingUserIds } },
        });
        await prisma.user.deleteMany({
          where: { id: { in: existingUserIds } },
        });
      }
    }
    await app.close();
  });

  describe('Design Versioning & Validation', () => {
    let designId: string;

    it('should reject invalid design JSON', async () => {
      const res = await request(app.getHttpServer())
        .post('/studio/designs')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          title: 'Invalid Design',
          designJson: { foo: 'bar' }, // missing width/height
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('Invalid design JSON');
    });

    it('should create a design and first version', async () => {
      const validJson = { width: 800, height: 600, elements: [] };
      const res = await request(app.getHttpServer())
        .post('/studio/designs')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          title: 'Valid Design',
          designJson: validJson,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Valid Design');
      expect(res.body.data.latestVersion.versionNumber).toBe(1);
      designId = res.body.data.id;
    });

    it('should increment version on update', async () => {
      const updatedJson = { width: 1000, height: 800, elements: [] };
      const res = await request(app.getHttpServer())
        .patch(`/studio/designs/${designId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          designJson: updatedJson,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.latestVersion.versionNumber).toBe(2);
    });

    it('should rollback to version 1', async () => {
      const res = await request(app.getHttpServer())
        .post(`/studio/designs/${designId}/rollback`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ versionNumber: 1 });

      expect(res.status).toBe(201);
      expect(res.body.data.latestVersion.versionNumber).toBe(3);
      expect(res.body.data.latestVersion.designJson.width).toBe(800);
    });

    it('should duplicate a design', async () => {
      const res = await request(app.getHttpServer())
        .post(`/studio/designs/${designId}/duplicate`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Valid Design (Copy)');
      expect(res.body.data.latestVersion.versionNumber).toBe(1);
    });
  });

  describe('Soft Delete Support', () => {
    let deleteDesignId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/studio/designs')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          title: 'Design to Delete',
          designJson: { width: 800, height: 600, elements: [] },
        });
      deleteDesignId = res.body.data.id;
    });

    it('should soft delete a design', async () => {
      const deleteRes = await request(app.getHttpServer())
        .delete(`/studio/designs/${deleteDesignId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(deleteRes.status).toBe(200);

      // Verify it cannot be retrieved via findOne
      const getRes = await request(app.getHttpServer())
        .get(`/studio/designs/${deleteDesignId}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(getRes.status).toBe(404);

      // Verify it is omitted from findAll
      const listRes = await request(app.getHttpServer())
        .get('/studio/designs')
        .set('Authorization', `Bearer ${customerToken}`);
      const deletedInList = listRes.body.data.find((d: any) => d.id === deleteDesignId);
      expect(deletedInList).toBeUndefined();

      const dbRecord = await prisma.studioDesign.findUnique({
        where: { id: deleteDesignId },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.deletedAt).not.toBeNull();
    });

    it('should reject submitting a soft-deleted design', async () => {
      const res = await request(app.getHttpServer())
        .post(`/studio/submissions/design/${deleteDesignId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(404);
    });
  });
  describe('Creator Templates', () => {
    let templateId: string;
    let creatorDesignVersionId: string;

    beforeAll(async () => {
      // Create a design as creator to get a DesignVersion id
      const res = await request(app.getHttpServer())
        .post('/studio/designs')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          title: 'Creator Base Design',
          designJson: { width: 800, height: 600, elements: [] },
        });
      creatorDesignVersionId = res.body.data.latestVersion.id;
    });

    it('should prevent CUSTOMER from creating template', async () => {
      const res = await request(app.getHttpServer())
        .post('/studio/templates')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          title: 'Customer Template',
          designJson: { width: 800, height: 600, elements: [] },
        });

      expect(res.status).toBe(403);
    });

    it('should allow CREATOR to create template draft', async () => {
      const res = await request(app.getHttpServer())
        .post('/studio/templates')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          title: 'Creator Template Draft',
          designVersionId: creatorDesignVersionId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Creator Template Draft');
      expect(res.body.data.status).toBe(TemplateStatus.DRAFT);
      templateId = res.body.data.id;
    });

    it('should reject publishing template without version snapshot', async () => {
      // Create template with raw designJson, no version ID
      const draftRes = await request(app.getHttpServer())
        .post('/studio/templates')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          title: 'No Snapshot Template',
          designJson: { width: 800, height: 600, elements: [] },
        });
      const noSnapId = draftRes.body.data.id;

      // Try to publish it
      const pubRes = await request(app.getHttpServer())
        .patch(`/studio/templates/${noSnapId}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ status: TemplateStatus.PUBLISHED });

      expect(pubRes.status).toBe(400);
      expect(JSON.stringify(pubRes.body.message)).toContain(
        'must be tied to a DesignVersion snapshot',
      );
    });

    it('should allow publishing template with version snapshot', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/studio/templates/${templateId}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ status: TemplateStatus.PUBLISHED });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TemplateStatus.PUBLISHED);
      expect(res.body.data.designVersionId).toBe(creatorDesignVersionId);
    });

    it('should enforce template immutability once published', async () => {
      // Try to modify title
      const resTitle = await request(app.getHttpServer())
        .patch(`/studio/templates/${templateId}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ title: 'New Hacked Title' });
      expect(resTitle.status).toBe(400);
      expect(JSON.stringify(resTitle.body.message)).toContain('Published templates are immutable');

      // Try to modify designJson
      const resJson = await request(app.getHttpServer())
        .patch(`/studio/templates/${templateId}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ designJson: { width: 1200, height: 900, elements: [] } });
      expect(resJson.status).toBe(400);
      expect(JSON.stringify(resJson.body.message)).toContain('Published templates are immutable');

      // Allow archiving
      const resArchive = await request(app.getHttpServer())
        .patch(`/studio/templates/${templateId}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ status: TemplateStatus.ARCHIVED });
      expect(resArchive.status).toBe(200);
      expect(resArchive.body.data.status).toBe(TemplateStatus.ARCHIVED);

      // Restore to published to allow cloning tests
      await prisma.creatorTemplate.update({
        where: { id: templateId },
        data: { status: TemplateStatus.PUBLISHED },
      });
    });

    it('should clone template to user design', async () => {
      const res = await request(app.getHttpServer())
        .post(`/studio/templates/${templateId}/clone`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Copy of Creator Template Draft');
      expect(res.body.data.latestVersion.versionNumber).toBe(1);
    });
  });

  describe('Approval Workflow', () => {
    let submissionDesignId: string;
    let submissionId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/studio/designs')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ title: 'Design to Submit', designJson: { width: 800, height: 600, elements: [] } });
      submissionDesignId = res.body.data.id;
    });

    it('should submit design', async () => {
      const res = await request(app.getHttpServer())
        .post(`/studio/submissions/design/${submissionDesignId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(SubmissionStatus.SUBMITTED);
      submissionId = res.body.data.id;
    });

    it('should not allow user to edit submitted design', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/studio/designs/${submissionDesignId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ title: 'Hacked Title' });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('Cannot edit a design');
    });

    it('should allow ADMIN to review and approve', async () => {
      // Review
      let res = await request(app.getHttpServer())
        .patch(`/studio/submissions/${submissionId}/review`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(SubmissionStatus.UNDER_REVIEW);

      // Approve
      res = await request(app.getHttpServer())
        .patch(`/studio/submissions/${submissionId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: SubmissionStatus.APPROVED, notes: 'Looks good' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(SubmissionStatus.APPROVED);

      // Verify parent design is APPROVED
      const designRes = await request(app.getHttpServer())
        .get(`/studio/designs/${submissionDesignId}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(designRes.body.data.status).toBe(DesignStatus.APPROVED);
    });
  });

  describe('Asset S3 Storage & Lifecycle', () => {
    let assetId: string;
    let uploadUrl: string;

    it('should request upload URL', async () => {
      const res = await request(app.getHttpServer())
        .post('/assets/upload-url')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          filename: 'test-image.png',
          mimeType: 'image/png',
          size: 51200, // 50KB
        });

      expect(res.status).toBe(201);
      expect(res.body.data.asset.filename).toBe('test-image.png');
      expect(res.body.data.asset.status).toBe(AssetStatus.PENDING);
      expect(res.body.data.uploadUrl).toBeDefined();

      assetId = res.body.data.asset.id;
      uploadUrl = res.body.data.uploadUrl;
    });

    it('should reject fetching download URL when asset is PENDING', async () => {
      const res = await request(app.getHttpServer())
        .get(`/assets/${assetId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('upload is not confirmed yet');
    });

    it('should upload the file to local MinIO using the presigned URL', async () => {
      // Put file contents directly using node native fetch
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: Buffer.from('mock-png-bytes'),
        headers: {
          'Content-Type': 'image/png',
        },
      });

      expect(response.status).toBe(200);
    });

    it('should confirm the asset upload', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/assets/${assetId}/confirm`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(AssetStatus.UPLOADED);
    });

    it('should fetch download URL and download successfully', async () => {
      const res = await request(app.getHttpServer())
        .get(`/assets/${assetId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.downloadUrl).toBeDefined();

      // Download content using the presigned download URL
      const response = await fetch(res.body.data.downloadUrl);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe('mock-png-bytes');
    });

    it('should enforce ownership on asset access', async () => {
      const res = await request(app.getHttpServer())
        .get(`/assets/${assetId}`)
        .set('Authorization', `Bearer ${customer2Token}`);

      expect(res.status).toBe(403);
    });

    it('should allow ADMIN to access user asset', async () => {
      const res = await request(app.getHttpServer())
        .get(`/assets/${assetId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('should delete asset and verify it is soft-deleted and inaccessible', async () => {
      // Try to delete as different user -> fails
      const deleteFailRes = await request(app.getHttpServer())
        .delete(`/assets/${assetId}`)
        .set('Authorization', `Bearer ${customer2Token}`);
      expect(deleteFailRes.status).toBe(403);

      // Delete as owner -> succeeds
      const deleteRes = await request(app.getHttpServer())
        .delete(`/assets/${assetId}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(deleteRes.status).toBe(204);

      // Verify it cannot be retrieved via get
      const getRes = await request(app.getHttpServer())
        .get(`/assets/${assetId}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(getRes.status).toBe(404);

      // Verify it status is DELETED in the database
      const dbRecord = await prisma.asset.findUnique({
        where: { id: assetId },
      });
      expect(dbRecord?.status).toBe(AssetStatus.DELETED);
    });
  });
});
