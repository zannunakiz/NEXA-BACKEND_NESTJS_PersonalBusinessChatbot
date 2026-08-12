jest.mock('@arcjet/node', () => ({
  __esModule: true,
  default: jest.fn(() => ({ protect: jest.fn(async () => null) })),
  detectBot: jest.fn(),
  fixedWindow: jest.fn(),
  shield: jest.fn(),
  ArcjetDecision: {},
}));

import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { E2eClient, makeUser } from './helpers';

jest.setTimeout(120000);

describe('NEXA Ultimate E2E', () => {
  let app: INestApplication;
  const client = new E2eClient();

  const owner = makeUser('owner');
  const admin = makeUser('admin');
  const memberA = makeUser('membera');
  const outsider = makeUser('outsider');
  const customerEmail = `customer_${Date.now()}@nuxa.ai`;

  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
      }),
    );
    await app.init();
    await app.listen(0);
    const address = app.getHttpServer().address();
    client.baseUrl = `http://127.0.0.1:${address.port}`;

    for (const name of ['owner', 'admin', 'memberA', 'outsider']) {
      const user = { owner, admin, memberA, outsider }[name];
      const { token } = await client.register(user);
      tokens[name] = token;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('auth flows and guards', async () => {
    const me = await client.api('GET', '/auth/me', undefined, tokens.owner);
    expect(me.ok).toBe(true);
    ids.ownerId = client.data(me).id;
    expect(ids.ownerId).toBeTruthy();

    const wrongLogin = await client.api('POST', '/auth/login', {
      emailOrUsername: owner.username,
      password: 'WrongPass!',
    });
    expect(wrongLogin.status).toBe(401);

    const ghostLogin = await client.api('POST', '/auth/login', {
      emailOrUsername: 'ghost_user',
      password: 'x',
    });
    expect(ghostLogin.status).toBe(401);

    const otpUnknown = await client.api('POST', '/auth/password-otp', {
      email: 'notregistered@x.com',
    });
    expect(otpUnknown.status).toBe(404);
  });

  it('organization ownership and membership rules', async () => {
    const created = await client.api(
      'POST',
      '/organization',
      { name: 'E2E Jest Org', description: 'jest e2e' },
      tokens.owner,
    );
    expect(created.ok).toBe(true);
    ids.orgId = client.data(created).id;

    const detailOwner = await client.api(
      'GET',
      `/organization/${ids.orgId}`,
      undefined,
      tokens.owner,
    );
    expect(detailOwner.ok).toBe(true);

    const detailOutsider = await client.api(
      'GET',
      `/organization/${ids.orgId}`,
      undefined,
      tokens.outsider,
    );
    expect(detailOutsider.status).toBe(403);

    const updateByMember = await client.api(
      'PUT',
      `/organization/${ids.orgId}`,
      { name: 'Hacked' },
      tokens.memberA,
    );
    expect(updateByMember.status).toBe(403);

    const inviteAdmin = await client.api(
      'POST',
      `/organization/${ids.orgId}/members/invite`,
      { email: admin.email, role: 'admin' },
      tokens.owner,
    );
    expect(inviteAdmin.ok).toBe(true);

    const inviteMemberA = await client.api(
      'POST',
      `/organization/${ids.orgId}/members/invite`,
      { email: memberA.email, role: 'member' },
      tokens.owner,
    );
    expect(inviteMemberA.ok).toBe(true);

    const inviteOwnerRole = await client.api(
      'POST',
      `/organization/${ids.orgId}/members/invite`,
      { email: outsider.email, role: 'owner' },
      tokens.owner,
    );
    expect(inviteOwnerRole.ok).toBe(false);

    const adminInviteAdmin = await client.api(
      'POST',
      `/organization/${ids.orgId}/members/invite`,
      { email: outsider.email, role: 'admin' },
      tokens.admin,
    );
    expect(adminInviteAdmin.ok).toBe(false);

    const memberList = await client.api(
      'GET',
      `/organization/${ids.orgId}/members`,
      undefined,
      tokens.owner,
    );
    expect(memberList.ok).toBe(true);
    const members = client.data(memberList);
    expect(Array.isArray(members)).toBe(true);
    if (Array.isArray(members)) {
      for (const m of members) {
        if (m.email === admin.email) ids.adminMemberId = m.id;
        if (m.email === memberA.email) ids.memberAMemberId = m.id;
      }
    }
    expect(ids.adminMemberId).toBeTruthy();

    const memberUpdateRole = await client.api(
      'PUT',
      `/organization/${ids.orgId}/members/${ids.adminMemberId}/role`,
      { role: 'admin' },
      tokens.memberA,
    );
    expect(memberUpdateRole.status).toBe(403);
  });

  it('chatbot lifecycle with member permissions', async () => {
    const botCreated = await client.multipart(
      'POST',
      '/chatbot',
      { organizationId: ids.orgId, name: 'E2E Bot', description: 'chat' },
      tokens.owner,
    );
    expect(botCreated.ok).toBe(true);
    ids.botId = client.data(botCreated).id;

    const outsiderCreate = await client.multipart(
      'POST',
      '/chatbot',
      { organizationId: ids.orgId, name: 'Hack' },
      tokens.outsider,
    );
    expect(outsiderCreate.status).toBe(403);

    const outsiderUpdate = await client.multipart(
      'PUT',
      `/chatbot/${ids.botId}`,
      { name: 'Hack' },
      tokens.outsider,
    );
    expect(outsiderUpdate.status).toBe(403);

    const charCreated = await client.api(
      'POST',
      `/characteristic/${ids.botId}`,
      { type: 'data', title: 'Hours', description: 'Open 10am-24pm' },
      tokens.owner,
    );
    expect(charCreated.ok).toBe(true);
    ids.charId = client.data(charCreated).id;

    const outsiderCharList = await client.api(
      'GET',
      `/characteristic/${ids.botId}`,
      undefined,
      tokens.outsider,
    );
    expect(outsiderCharList.status).toBe(403);

    const memberUpdateChar = await client.api(
      'PUT',
      `/characteristic/${ids.botId}/${ids.charId}`,
      { description: 'Updated by member' },
      tokens.memberA,
    );
    expect(memberUpdateChar.ok).toBe(true);
  });

  it('session and chat work for customers', async () => {
    const sessionCreate = await client.api(
      'POST',
      `/session/${ids.botId}`,
      { email: customerEmail },
    );
    expect(sessionCreate.ok).toBe(true);
    ids.sessionId = client.data(sessionCreate).session.id;

    const sessionResume = await client.api(
      'POST',
      `/session/${ids.botId}`,
      { email: customerEmail },
    );
    expect(client.data(sessionResume).resumed).toBe(true);

    const chatSent = await client.api(
      'POST',
      `/chat/${ids.sessionId}`,
      { email: customerEmail, customer_chat: 'What are your opening hours?' },
    );
    expect(chatSent.ok).toBe(true);

    const chatWrongEmail = await client.api(
      'POST',
      `/chat/${ids.sessionId}`,
      { email: 'wrong@x.com', customer_chat: 'hi' },
    );
    expect(chatWrongEmail.status).toBe(404);

    const outsiderDeleteSession = await client.api(
      'DELETE',
      `/session/remove/${ids.sessionId}`,
      undefined,
      tokens.outsider,
    );
    expect(outsiderDeleteSession.status).toBe(403);
  });

  it('ownership transfer rules', async () => {
    const adminId = (await client.me(tokens.admin)).id;

    const memberTransfer = await client.api(
      'POST',
      `/organization/${ids.orgId}/transfer-ownership`,
      { newOwnerId: adminId },
      tokens.memberA,
    );
    expect(memberTransfer.status).toBe(403);

    const transfer = await client.api(
      'POST',
      `/organization/${ids.orgId}/transfer-ownership`,
      { newOwnerId: adminId },
      tokens.owner,
    );
    expect(transfer.ok).toBe(true);

    const adminUpdate = await client.api(
      'PUT',
      `/organization/${ids.orgId}`,
      { name: 'Renamed By New Owner' },
      tokens.admin,
    );
    expect(adminUpdate.ok).toBe(true);

    const oldOwnerUpdate = await client.api(
      'PUT',
      `/organization/${ids.orgId}`,
      { name: 'Hack' },
      tokens.owner,
    );
    expect(oldOwnerUpdate.status).toBe(403);
  });

  it('master key guards', async () => {
    const wrong = await client.api('POST', '/master/getallusers', {
      masterKey: 'wrong-key',
    });
    expect(wrong.status).toBe(401);

    const correct = await client.api('POST', '/master/getallusers', {
      masterKey: 'master-key',
    });
    expect(correct.ok).toBe(true);
  });
});

