import { Test, TestingModule } from '@nestjs/testing';
import { AuditService, AUDIT_ACTIONS } from './audit.service';
import { PrismaService } from '../../config/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      auditLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prismaService }],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should persist an audit log with all fields', () => {
    prismaService.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    service.create({
      userId: 'user-1',
      action: AUDIT_ACTIONS.USER_LOGIN,
      details: { email: 'test@example.com' },
      ipAddress: '127.0.0.1',
    });

    expect(prismaService.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        action: 'USER_LOGIN',
        details: { email: 'test@example.com' },
        ipAddress: '127.0.0.1',
      },
    });
  });

  it('should allow nullable userId for guest events', () => {
    prismaService.auditLog.create.mockResolvedValue({ id: 'audit-2' });

    service.create({
      action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
      details: { orderId: 'order-1', oldStatus: 'PENDING', newStatus: 'PAID' },
    });

    expect(prismaService.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        action: 'ORDER_STATUS_CHANGED',
      }),
    });
  });

  it('should not throw when audit persistence fails', async () => {
    const error = new Error('database unavailable');
    prismaService.auditLog.create.mockRejectedValue(error);
    const loggerErrorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

    expect(() =>
      service.create({
        userId: 'user-1',
        action: AUDIT_ACTIONS.USER_LOGIN,
      }),
    ).not.toThrow();

    // Allow the promise microtask to run.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to persist audit log for action USER_LOGIN'),
    );
  });
});
