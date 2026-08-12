import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SessionService } from '../../src/session/session.service';

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
  };
}

function createService(db: any, config: any): SessionService {
  return new SessionService(db, config);
}

const chatbotRow = {
  id: 'bot-1',
  organization_id: 'org-1',
  name: 'Bot',
  description: null,
  image_url: null,
  system_prompt: null,
  welcome_message: null,
};
const characteristicRow = {
  id: 'char-1',
  type: 'data',
  title: 'Opening hours',
  description: '10am-24pm',
};

describe('SessionService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('getOrCreateSession', () => {
    it('throws NotFoundException when the chatbot does not exist', async () => {
      const m = createMock();
      const service = createService(m.database, m.config);
      m.database.executeReadMain.mockResolvedValueOnce([]);

      await expect(service.getOrCreateSession('missing', 'a@b.com')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the chatbot is inactive (no characteristics)', async () => {
      const m = createMock();
      const service = createService(m.database, m.config);
      m.database.executeReadMain
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([]);

      await expect(service.getOrCreateSession('bot-1', 'a@b.com')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('resumes an existing session and returns chat histories', async () => {
      const m = createMock();
      const service = createService(m.database, m.config);
      const session = {
        id: 's1',
        organization_id: 'org-1',
        chatbot_id: 'bot-1',
        start_session_date: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };
      m.database.executeReadMain
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([characteristicRow])
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce([
          { id: 'c1', session_id: 's1', chatbot_id: 'bot-1', ai_chat: 'hi', customer_chat: 'hello', created_at: new Date() },
        ]);

      const result = await service.getOrCreateSession('bot-1', 'a@b.com');
      expect(result.resumed).toBe(true);
      expect(result.session.id).toBe('s1');
      expect(result.chats).toHaveLength(1);
    });

    it('creates a new session when none exists', async () => {
      const m = createMock();
      const service = createService(m.database, m.config);
      const newSession = {
        id: 's2',
        organization_id: 'org-1',
        chatbot_id: 'bot-1',
        start_session_date: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };
      m.database.executeReadMain
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([characteristicRow])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([newSession]);

      const result = await service.getOrCreateSession('bot-1', 'a@b.com');
      expect(result.resumed).toBe(false);
      expect(m.database.executeWrite).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeSession', () => {
    it('throws ForbiddenException when the user is not a member', async () => {
      const m = createMock();
      const service = createService(m.database, m.config);
      m.database.executeReadMain
        .mockResolvedValueOnce([{ id: 's1', organization_id: 'org-1', chatbot_id: 'bot-1' }])
        .mockResolvedValueOnce([]);

      await expect(service.removeSession('s1', 'outsider')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('deletes the session for an org member', async () => {
      const m = createMock();
      const service = createService(m.database, m.config);
      m.database.executeReadMain
        .mockResolvedValueOnce([{ id: 's1', organization_id: 'org-1', chatbot_id: 'bot-1' }])
        .mockResolvedValueOnce([{ id: 'm1' }]);

      await service.removeSession('s1', 'user-1');
      expect(m.database.executeWrite).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeAllSessions', () => {
    it('throws NotFoundException when the chatbot does not exist', async () => {
      const m = createMock();
      const service = createService(m.database, m.config);
      m.database.executeReadMain.mockResolvedValueOnce([]);

      await expect(service.removeAllSessions('missing', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
