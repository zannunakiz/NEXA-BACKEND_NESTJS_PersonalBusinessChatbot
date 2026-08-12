import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CharacteristicService } from '../../src/characteristic/characteristic.service';

function createMock() {
  return {
    database: {
      executeRead: jest.fn(async () => []),
      executeReadMain: jest.fn(async () => []),
      executeWrite: jest.fn(async () => undefined),
      executeWriteReturning: jest.fn(async () => []),
    },
  };
}

function createService(db: any): CharacteristicService {
  return new CharacteristicService(db);
}

const chatbotRow = { organization_id: 'org-1' };
const memberRow = { id: 'm1' };
const charRow = {
  id: 'char-1',
  chatbot_id: 'bot-1',
  created_by: 'user-1',
  updated_by: 'user-1',
  type: 'data',
  title: 'Opening hours',
  description: '10am-24pm',
  created_at: new Date(),
  updated_at: new Date(),
};

describe('CharacteristicService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('createCharacteristic', () => {
    it('creates a characteristic for an org member', async () => {
      const m = createMock();
      const service = createService(m.database);
      m.database.executeReadMain
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([memberRow])
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([memberRow])
        .mockResolvedValueOnce([charRow]);

      const result = await service.createCharacteristic(
        'bot-1',
        'user-1',
        { type: 'data', title: 'Opening hours', description: '10am' },
      );

      expect(m.database.executeWrite).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('char-1');
    });

    it('throws ForbiddenException when the user is not a member', async () => {
      const m = createMock();
      const service = createService(m.database);
      m.database.executeReadMain
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([]);

      await expect(
        service.createCharacteristic('bot-1', 'outsider', {
          type: 'data',
          title: 'T',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('listCharacteristics', () => {
    it('returns characteristics of the chatbot', async () => {
      const m = createMock();
      const service = createService(m.database);
      m.database.executeReadMain
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([memberRow])
        .mockResolvedValueOnce([charRow]);

      const result = await service.listCharacteristics('bot-1', 'user-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getCharacteristic', () => {
    it('throws NotFoundException when the characteristic is missing', async () => {
      const m = createMock();
      const service = createService(m.database);
      m.database.executeReadMain
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([memberRow])
        .mockResolvedValueOnce([]);

      await expect(
        service.getCharacteristic('bot-1', 'missing', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateCharacteristic', () => {
    it('rejects an empty update payload', async () => {
      const m = createMock();
      const service = createService(m.database);
      m.database.executeReadMain
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([memberRow])
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([memberRow])
        .mockResolvedValueOnce([charRow]);

      await expect(
        service.updateCharacteristic('bot-1', 'char-1', 'user-1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates provided fields and returns the updated row', async () => {
      const m = createMock();
      const service = createService(m.database);
      const updated = { ...charRow, description: 'Updated' };
      m.database.executeReadMain
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([memberRow])
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([memberRow])
        .mockResolvedValueOnce([charRow])
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([memberRow])
        .mockResolvedValueOnce([updated]);

      const result = await service.updateCharacteristic(
        'bot-1',
        'char-1',
        'user-1',
        { description: 'Updated' },
      );

      expect(m.database.executeWrite).toHaveBeenCalledTimes(1);
      expect(result.description).toBe('Updated');
    });
  });

  describe('deleteCharacteristic', () => {
    it('deletes an existing characteristic', async () => {
      const m = createMock();
      const service = createService(m.database);
      m.database.executeReadMain
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([memberRow])
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([memberRow])
        .mockResolvedValueOnce([charRow]);

      await service.deleteCharacteristic('bot-1', 'char-1', 'user-1');
      expect(m.database.executeWrite).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteAllCharacteristics', () => {
    it('deletes all characteristics of the chatbot', async () => {
      const m = createMock();
      const service = createService(m.database);
      m.database.executeReadMain
        .mockResolvedValueOnce([chatbotRow])
        .mockResolvedValueOnce([memberRow]);

      await service.deleteAllCharacteristics('bot-1', 'user-1');
      expect(m.database.executeWrite).toHaveBeenCalledTimes(1);
    });
  });
});
