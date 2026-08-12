import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChatService } from '../../src/chat/chat.service';


function createMock() {
  return {
    database: {
      executeRead: jest.fn(async () => []),
      executeReadMain: jest.fn(async () => []),
      executeWrite: jest.fn(async () => undefined),
      executeWriteReturning: jest.fn(async () => []),
    },
    config: {
      get: jest.fn(() => undefined),
    },
    openRouter: {
      generateChat: jest.fn(),
    },
  };
}

function createService(db: any, config: any, openRouter: any): ChatService {
  return new ChatService(db, config, openRouter);
}

const sessionRow = { id: 's1', organization_id: 'org-1', chatbot_id: 'bot-1' };
const chatbotRow = { name: 'Bot', system_prompt: 'be nice', welcome_message: 'Hi' };
const characteristicRow = { type: 'data', title: 'Hours', description: '10am-24pm' };

describe('ChatService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('sendMessage', () => {
    it('throws NotFoundException when the session/email does not match', async () => {
      const m = createMock();
      const service = createService(m.database, m.config, m.openRouter);
      m.database.executeReadMain.mockResolvedValueOnce([]);

      await expect(
        service.sendMessage('s1', 'nobody@x.com', 'hello'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the AI reply and persists the paired chat', async () => {
      const m = createMock();
      const service = createService(m.database, m.config, m.openRouter);
      m.database.executeReadMain
        .mockResolvedValueOnce([sessionRow])
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([characteristicRow])
        .mockResolvedValueOnce([]);
      m.openRouter.generateChat.mockResolvedValue('{"reply": "We open at 10am."}');

      const result = await service.sendMessage('s1', 'a@b.com', 'What hours?');

      expect(m.openRouter.generateChat).toHaveBeenCalledTimes(1);
      expect(m.database.executeWrite).toHaveBeenCalledTimes(1);
      expect(result.reply).toBe('We open at 10am.');
      expect(result.customer_chat).toBe('What hours?');
    });

    it('throws BadRequestException when the AI returns nothing', async () => {
      const m = createMock();
      const service = createService(m.database, m.config, m.openRouter);
      m.database.executeReadMain
        .mockResolvedValueOnce([sessionRow])
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([characteristicRow])
        .mockResolvedValueOnce([]);
      m.openRouter.generateChat.mockResolvedValue('');

      await expect(
        service.sendMessage('s1', 'a@b.com', 'hello'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(m.database.executeWrite).not.toHaveBeenCalled();
    });
  });

  describe('deleteChats', () => {
    it('throws NotFoundException when the session/email does not match', async () => {
      const m = createMock();
      const service = createService(m.database, m.config, m.openRouter);
      m.database.executeReadMain.mockResolvedValueOnce([]);

      await expect(service.deleteChats('s1', 'nobody@x.com')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletes all chats for a matching session', async () => {
      const m = createMock();
      const service = createService(m.database, m.config, m.openRouter);
      m.database.executeReadMain.mockResolvedValueOnce([{ id: 's1' }]);

      await service.deleteChats('s1', 'a@b.com');
      expect(m.database.executeWrite).toHaveBeenCalledTimes(1);
    });
  });
});
