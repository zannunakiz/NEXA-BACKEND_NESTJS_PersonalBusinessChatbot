import {
  BadRequestException,
  GoneException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../src/auth/auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

function createDatabaseMock(overrides = {}) {
  return {
    executeRead: jest.fn(async () => []),
    executeReadMain: jest.fn(async () => []),
    executeWrite: jest.fn(async () => undefined),
    executeWriteReturning: jest.fn(async () => []),
    ...overrides,
  };
}

function createService(database: ReturnType<typeof createDatabaseMock>) {
  const jwt = {
    sign: jest.fn(() => 'signed-token'),
    verify: jest.fn(() => ({ sub: 'user-1', exp: 9999999999 })),
  };
  const config = {
    get: jest.fn(() => undefined),
  };
  const redis = {
    setRefreshToken: jest.fn(async () => undefined),
    getRefreshToken: jest.fn(async () => 'token'),
    deleteRefreshToken: jest.fn(async () => undefined),
    blacklistToken: jest.fn(async () => undefined),
  };
  const emailjs = {
    sendEmail: jest.fn(async () => true),
  };

  const service = new AuthService(
    database as never,
    jwt as never,
    config as never,
    redis as never,
    emailjs as never,
  );

  return { service, database, jwt, config, redis, emailjs };
}

const userRow = {
  id: 'user-1',
  email: 'a@b.com',
  username: 'alice',
  password_hash: 'hashed',
  image_url: null,
  created_at: new Date('2025-01-01'),
};

describe('AuthService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('creates a user and returns tokens when no conflict exists', async () => {
      mockedBcrypt.hash.mockResolvedValue('hashed' as never);
      const db = createDatabaseMock();
      db.executeRead.mockResolvedValueOnce([]);
      const { service, redis, jwt } = createService(db);

      const result = await service.register('a@b.com', 'alice', 'pass1234');

      expect(db.executeWrite).toHaveBeenCalledTimes(1);
      expect(jwt.sign).toHaveBeenCalledTimes(2);
      expect(redis.setRefreshToken).toHaveBeenCalledTimes(1);
      expect(result.user.email).toBe('a@b.com');
    });

    it('throws ConflictException when email or username is taken', async () => {
      const db = createDatabaseMock();
      db.executeRead.mockResolvedValueOnce([userRow]);
      const { service } = createService(db);

      await expect(
        service.register('a@b.com', 'alice', 'pass1234'),
      ).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      mockedBcrypt.compare.mockResolvedValue(true as never);
      const db = createDatabaseMock();
      db.executeRead.mockResolvedValueOnce([userRow]);
      const { service } = createService(db);

      const result = await service.login('alice', 'pass1234');
      expect(result.user.username).toBe('alice');
      expect(result.accessToken).toBe('signed-token');
    });

    it('throws UnauthorizedException for wrong password', async () => {
      mockedBcrypt.compare.mockResolvedValue(false as never);
      const db = createDatabaseMock();
      db.executeRead.mockResolvedValueOnce([userRow]);
      const { service } = createService(db);

      await expect(service.login('alice', 'wrong')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      const db = createDatabaseMock();
      db.executeRead.mockResolvedValueOnce([]);
      const { service } = createService(db);

      await expect(service.login('ghost', 'pass')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('requestOtp', () => {
    it('throws NotFoundException when email is not registered', async () => {
      const db = createDatabaseMock();
      db.executeRead.mockResolvedValueOnce([]);
      const { service } = createService(db);

      await expect(service.requestOtp('nobody@x.com')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('sends otp and persists it for an existing user', async () => {
      const db = createDatabaseMock();
      db.executeRead.mockResolvedValueOnce([userRow]);
      const { service, emailjs } = createService(db);

      const result = await service.requestOtp('a@b.com');

      expect(emailjs.sendEmail).toHaveBeenCalledTimes(1);
      expect(db.executeWrite).toHaveBeenCalledTimes(1);
      expect(result.message).toContain('Password reset code sent successfully');
    });
  });

  describe('resetPassword', () => {
    it('throws NotFoundException when user does not exist', async () => {
      const db = createDatabaseMock();
      db.executeRead.mockResolvedValueOnce([]);
      const { service } = createService(db);

      await expect(
        service.resetPassword('nobody@x.com', '123456', 'NewPass123!'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws GoneException when the otp is expired', async () => {
      const expired = {
        ...userRow,
        otp_code: '123456',
        otp_expired_at: new Date(Date.now() - 60000),
      };
      const db = createDatabaseMock();
      db.executeRead.mockResolvedValueOnce([expired]);
      const { service } = createService(db);

      await expect(
        service.resetPassword('a@b.com', '123456', 'NewPass123!'),
      ).rejects.toBeInstanceOf(GoneException);
    });

    it('throws BadRequestException when the otp is wrong', async () => {
      const row = {
        ...userRow,
        otp_code: '999999',
        otp_expired_at: new Date(Date.now() + 600000),
      };
      const db = createDatabaseMock();
      db.executeRead.mockResolvedValueOnce([row]);
      const { service } = createService(db);

      await expect(
        service.resetPassword('a@b.com', '123456', 'NewPass123!'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('hashing new password and clearing otp on success', async () => {
      mockedBcrypt.hash.mockResolvedValue('new-hash' as never);
      const row = {
        ...userRow,
        otp_code: '123456',
        otp_expired_at: new Date(Date.now() + 600000),
      };
      const db = createDatabaseMock();
      db.executeRead.mockResolvedValueOnce([row]);
      const { service } = createService(db);

      const result = await service.resetPassword(
        'a@b.com',
        '123456',
        'NewPass123!',
      );

      expect(db.executeWrite).toHaveBeenCalledTimes(1);
      expect(result.message).toBe('Password reset successfully');
    });
  });
});
