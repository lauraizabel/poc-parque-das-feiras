import assert from "node:assert/strict";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AuthFlowAuditAction, AuthFlowTokenPurpose } from "@prisma/client";
import { prisma } from "@acme/database";
import { AppModule } from "../app.module";
import { EmailNotificationJob } from "../notifications/notifications.queue";
import { NotificationsService } from "../notifications/notifications.service";

type JsonResponse<T> = {
  statusCode: number;
  body: T;
};

type RequestOptions = {
  method?: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
};

describe("auth token flows", () => {
  const suffix = Date.now().toString(36);
  const password = "StrongPass123";
  const nextPassword = "NewStrongPass456";

  let app: INestApplication;
  let notificationsService: NotificationsService;
  let baseUrl = "";
  const userIds: string[] = [];
  const queuedNotifications: EmailNotificationJob[] = [];

  before(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = testingModule.createNestApplication();
    await app.listen(0);

    notificationsService = app.get(NotificationsService);
    notificationsService.enqueueEmailNotification = (async (input: EmailNotificationJob) => {
      queuedNotifications.push(input);

      return {
        queued: true,
        queue: notificationsService.getQueueMonitoring().queue,
        jobId: `auth-test-email-${queuedNotifications.length}`,
        notification: {
          to: input.to,
          subject: input.subject,
          templateKey: input.templateKey
        }
      };
    }) as NotificationsService["enqueueEmailNotification"];

    const server = app.getHttpServer() as http.Server;
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    queuedNotifications.length = 0;
  });

  after(async () => {
    for (const userId of userIds) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => null);
    }

    await app.close();
  });

  it("issues an email verification token, confirms the account and blocks token reuse", async () => {
    const email = `verify-${suffix}@example.com`;

    const registration = await requestJson<{
      user: { id: string; email: string; emailVerifiedAt: string | null };
    }>({
      method: "POST",
      path: "/auth/register",
      body: {
        email,
        password,
        fullName: "Verify User"
      }
    });

    assert.equal(registration.statusCode, 201);
    userIds.push(registration.body.user.id);
    assert.equal(registration.body.user.emailVerifiedAt, null);
    assert.equal(queuedNotifications.length, 1);
    assert.equal(queuedNotifications[0]?.to, email);
    assert.equal(queuedNotifications[0]?.templateKey, "auth-email-verification");

    const verificationToken = String(queuedNotifications[0]?.variables?.token ?? "");
    assert.match(verificationToken, /^[a-f0-9]{48}$/);

    const storedVerificationToken = await prisma.authFlowToken.findFirst({
      where: {
        userId: registration.body.user.id,
        purpose: AuthFlowTokenPurpose.EMAIL_VERIFICATION
      }
    });
    assert.ok(storedVerificationToken);
    assert.equal(storedVerificationToken?.consumedAt, null);

    const verificationResponse = await requestJson<{
      success: boolean;
      user: { emailVerifiedAt: string | null };
    }>({
      method: "POST",
      path: "/auth/verify-email",
      body: {
        token: verificationToken
      }
    });

    assert.equal(verificationResponse.statusCode, 200);
    assert.equal(verificationResponse.body.success, true);
    assert.ok(verificationResponse.body.user.emailVerifiedAt);

    const verifiedUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: registration.body.user.id
      }
    });
    assert.ok(verifiedUser.emailVerifiedAt);

    const consumedToken = await prisma.authFlowToken.findUniqueOrThrow({
      where: {
        id: storedVerificationToken!.id
      }
    });
    assert.ok(consumedToken.consumedAt);

    const reuseResponse = await requestJson<{
      code: string;
    }>({
      method: "POST",
      path: "/auth/verify-email",
      body: {
        token: verificationToken
      }
    });

    assert.equal(reuseResponse.statusCode, 404);
    assert.equal(reuseResponse.body.code, "AUTH_FLOW_TOKEN_NOT_FOUND");

    const audits = await prisma.authFlowAudit.findMany({
      where: {
        userId: registration.body.user.id,
        purpose: AuthFlowTokenPurpose.EMAIL_VERIFICATION
      },
      orderBy: {
        createdAt: "asc"
      }
    });
    assert.deepEqual(
      audits.map((audit) => audit.action),
      [
        AuthFlowAuditAction.EMAIL_VERIFICATION_REQUESTED,
        AuthFlowAuditAction.EMAIL_VERIFICATION_CONFIRMED
      ]
    );
  });

  it("issues password reset tokens, invalidates prior tokens and updates the password", async () => {
    const email = `reset-${suffix}@example.com`;

    const registration = await requestJson<{
      user: { id: string };
    }>({
      method: "POST",
      path: "/auth/register",
      body: {
        email,
        password,
        fullName: "Reset User"
      }
    });

    assert.equal(registration.statusCode, 201);
    userIds.push(registration.body.user.id);
    queuedNotifications.length = 0;

    const firstResetRequest = await requestJson<{
      success: boolean;
    }>({
      method: "POST",
      path: "/auth/request-password-reset",
      body: {
        email
      }
    });

    assert.equal(firstResetRequest.statusCode, 202);
    assert.equal(firstResetRequest.body.success, true);
    assert.equal(queuedNotifications.length, 1);
    assert.equal(queuedNotifications[0]?.templateKey, "auth-password-reset");
    const firstResetToken = String(queuedNotifications[0]?.variables?.token ?? "");

    const secondResetRequest = await requestJson<{
      success: boolean;
    }>({
      method: "POST",
      path: "/auth/request-password-reset",
      body: {
        email
      }
    });

    assert.equal(secondResetRequest.statusCode, 202);
    assert.equal(secondResetRequest.body.success, true);
    assert.equal(queuedNotifications.length, 2);
    const secondResetToken = String(queuedNotifications[1]?.variables?.token ?? "");
    assert.notEqual(firstResetToken, secondResetToken);

    const resetTokens = await prisma.authFlowToken.findMany({
      where: {
        userId: registration.body.user.id,
        purpose: AuthFlowTokenPurpose.PASSWORD_RESET
      },
      orderBy: {
        createdAt: "asc"
      }
    });
    assert.equal(resetTokens.length, 2);
    assert.ok(resetTokens[0]?.invalidatedAt);
    assert.equal(resetTokens[1]?.invalidatedAt, null);

    const invalidatedResetAttempt = await requestJson<{
      code: string;
    }>({
      method: "POST",
      path: "/auth/reset-password",
      body: {
        token: firstResetToken,
        password: nextPassword
      }
    });

    assert.equal(invalidatedResetAttempt.statusCode, 404);
    assert.equal(invalidatedResetAttempt.body.code, "AUTH_FLOW_TOKEN_NOT_FOUND");

    const resetResponse = await requestJson<{
      success: boolean;
    }>({
      method: "POST",
      path: "/auth/reset-password",
      body: {
        token: secondResetToken,
        password: nextPassword
      }
    });

    assert.equal(resetResponse.statusCode, 200);
    assert.equal(resetResponse.body.success, true);

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: registration.body.user.id
      }
    });
    assert.equal(updatedUser.refreshTokenHash, null);

    const oldPasswordLogin = await requestJson<{
      message: string;
    }>({
      method: "POST",
      path: "/auth/login",
      body: {
        email,
        password
      }
    });
    assert.equal(oldPasswordLogin.statusCode, 401);
    assert.equal(oldPasswordLogin.body.message, "Invalid email or password");

    const newPasswordLogin = await requestJson<{
      user: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/login",
      body: {
        email,
        password: nextPassword
      }
    });
    assert.equal(newPasswordLogin.statusCode, 200);
    assert.equal(newPasswordLogin.body.user.id, registration.body.user.id);
    assert.ok(newPasswordLogin.body.tokens.accessToken);

    const resetAudits = await prisma.authFlowAudit.findMany({
      where: {
        userId: registration.body.user.id,
        purpose: AuthFlowTokenPurpose.PASSWORD_RESET
      },
      orderBy: {
        createdAt: "asc"
      }
    });
    assert.deepEqual(
      resetAudits.map((audit) => audit.action),
      [
        AuthFlowAuditAction.PASSWORD_RESET_REQUESTED,
        AuthFlowAuditAction.PASSWORD_RESET_REQUESTED,
        AuthFlowAuditAction.PASSWORD_RESET_COMPLETED
      ]
    );
  });

  async function requestJson<T>(options: RequestOptions): Promise<JsonResponse<T>> {
    const response = await fetch(`${baseUrl}${options.path}`, {
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(options.headers ?? {})
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    return {
      statusCode: response.status,
      body: (await response.json()) as T
    };
  }
});
