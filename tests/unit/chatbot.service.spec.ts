import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ChatbotService } from '../../src/chatbot/chatbot.service';

function createMock() {
  return {
    database: {
      executeRead: jest.fn(async () => []),
      executeReadMain: jest.fn(async () => []),
      executeWrite: jest.fn(async () => undefined),
      executeWriteReturning: jest.fn(async () => []),
    },
    cloudinary: {
      uploadImage: jest.fn(),
      deleteImage: jest.fn(async () => undefined),
      extractPublicId: jest.fn(() => null),
    },
  };
}

function createService(db: any, cloudinary: any): ChatbotService {
  return new ChatbotService(db, cloudinary);
}

const chatbotRow = {
  id: 'bot-1',
  organization_id: 'org-1',
  name: 'Support Bot',
  description: null,
  image_url: null,
  system_prompt: null,
  welcome_message: null,
  created_by: 'user-1',
  updated_by: 'user-1',
  created_at: new Date(),
  updated_at: new Date(),
};

describe('ChatbotService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('createChatbot', () => {
    it('creates a chatbot without an image for a member', async () => {
      const m = createMock();
      const service = createService(m.database, m.cloudinary);
      m.database.executeReadMain
        .mockResolvedValueOnce([{ id: 'm1' }])
        .mockResolvedValueOnce([chatbotRow]);

      const result = await service.createChatbot(
        'org-1',
        'user-1',
        { organizationId: 'org-1', name: 'Support Bot' },
        undefined,
      );

      expect(m.database.executeWrite).toHaveBeenCalledTimes(1);
      expect(m.cloudinary.uploadImage).not.toHaveBeenCalled();
      expect(result.id).toBe('bot-1');
    });

    it('uploads image to cloudinary first when a file is provided', async () => {
      const m = createMock();
      const service = createService(m.database, m.cloudinary);
      m.database.executeReadMain
        .mockResolvedValueOnce([{ id: 'm1' }])
        .mockResolvedValueOnce([chatbotRow]);
      m.cloudinary.uploadImage.mockResolvedValue({
        secure_url: 'https://cdn/image.png',
      });

      const file = { buffer: Buffer.from('x') } as Express.Multer.File;
      await service.createChatbot(
        'org-1',
        'user-1',
        { organizationId: 'org-1', name: 'Bot' },
        file,
      );

      expect(m.cloudinary.uploadImage).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenException when the user is not a member', async () => {
      const m = createMock();
      const service = createService(m.database, m.cloudinary);
      m.database.executeReadMain.mockResolvedValueOnce([]);

      await expect(
        service.createChatbot(
          'org-1',
          'outsider',
          { organizationId: 'org-1', name: 'Bot' },
          undefined,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getChatbotsByOrganization', () => {
    it('returns chatbots for an organization member', async () => {
      const m = createMock();
      const service = createService(m.database, m.cloudinary);
      m.database.executeReadMain
        .mockResolvedValueOnce([{ id: 'm1' }])
        .mockResolvedValueOnce([chatbotRow]);

      const result = await service.getChatbotsByOrganization('org-1', 'user-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getMyChatbots', () => {
    it('returns only chatbots created by the given user', async () => {
      const m = createMock();
      const service = createService(m.database, m.cloudinary);
      m.database.executeReadMain
        .mockResolvedValueOnce([{ id: 'm1' }])
        .mockResolvedValueOnce([chatbotRow]);

      const result = await service.getMyChatbots('org-1', 'user-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('updateChatbot', () => {
    it('throws BadRequestException when no field or image is provided', async () => {
      const m = createMock();
      const service = createService(m.database, m.cloudinary);
      m.database.executeReadMain
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([{ id: 'm1' }]);

      await expect(
        service.updateChatbot('bot-1', 'user-1', {}, undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when the chatbot does not exist', async () => {
      const m = createMock();
      const service = createService(m.database, m.cloudinary);
      m.database.executeReadMain.mockResolvedValueOnce([]);

      await expect(
        service.updateChatbot(
          'missing',
          'user-1',
          { name: 'New' },
          undefined,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates provided fields and keeps the old image', async () => {
      const m = createMock();
      const service = createService(m.database, m.cloudinary);
      const updated = { ...chatbotRow, name: 'Renamed' };
      m.database.executeReadMain
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([{ id: 'm1' }])
        .mockResolvedValueOnce([updated]);

      const result = await service.updateChatbot(
        'bot-1',
        'user-1',
        { name: 'Renamed' },
        undefined,
      );

      expect(m.database.executeWrite).toHaveBeenCalledTimes(1);
      expect(result.name).toBe('Renamed');
    });
  });

  describe('deleteChatbot', () => {
    it('deletes the chatbot image and row', async () => {
      const m = createMock();
      const service = createService(m.database, m.cloudinary);
      const withImage = { ...chatbotRow, image_url: 'https://cdn/x.png' };
      m.database.executeReadMain
        .mockResolvedValueOnce([withImage])
        .mockResolvedValueOnce([{ id: 'm1' }]);

      await service.deleteChatbot('bot-1', 'user-1');

      expect(m.cloudinary.deleteImage).toHaveBeenCalledWith(
        'https://cdn/x.png',
      );
      expect(m.database.executeWrite).toHaveBeenCalledTimes(1);
    });
  });
});
