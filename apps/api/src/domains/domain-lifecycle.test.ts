import assert from "node:assert/strict";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DomainStatus } from "@prisma/client";
import { prisma } from "@acme/database";
import { AppModule } from "../app.module";
import { DomainsDnsService } from "./domains-dns.service";
import { DomainsService } from "./domains.service";
import { DomainsSslService } from "./domains-ssl.service";

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

describe("domain lifecycle", () => {
  const suffix = Date.now().toString(36);
  const email = `domain-lifecycle-${suffix}@example.com`;
  const password = "StrongPass123";
  const storeSlug = `domain-cycle-${suffix}`;
  const customHost = `www.${storeSlug}.com`;
  const fallbackHost = `${storeSlug}.lvh.me`;

  let app: INestApplication;
  let domainsService: DomainsService;
  let baseUrl = "";
  let userId = "";
  let storeId = "";
  let token = "";
  let currentDnsTarget = "wrong-target.example.com";
  let currentSslStatus: "pending" | "active" = "pending";

  before(async () => {
    const dnsResolverMock: Pick<DomainsDnsService, "resolveCname"> = {
      resolveCname: async () => ({
        configuredTarget: currentDnsTarget
      })
    };

    const sslServiceMock: Pick<
      DomainsSslService,
      "provisionDomain" | "getProvisioningStatus"
    > = {
      provisionDomain: async ({ domainId, host }) => ({
        externalId: `mock-${domainId}`,
        status: "pending",
        payload: {
          provider: "TEST_PROVIDER",
          host,
          provisioningStage: "hostname-accepted"
        }
      }),
      getProvisioningStatus: async ({ externalId, host }) => ({
        status: currentSslStatus,
        payload: {
          provider: "TEST_PROVIDER",
          externalId,
          host,
          provisioningStage:
            currentSslStatus === "active"
              ? "certificate-active"
              : "certificate-pending"
        }
      })
    };

    const testingModule = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(DomainsDnsService)
      .useValue(dnsResolverMock)
      .overrideProvider(DomainsSslService)
      .useValue(sslServiceMock)
      .compile();

    app = testingModule.createNestApplication();
    app.enableCors({
      origin: true,
      credentials: true
    });

    await app.listen(0);
    domainsService = app.get(DomainsService);

    const server = app.getHttpServer() as http.Server;
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const registration = await requestJson<{
      user: { id: string };
      store: { id: string };
      tokens: { accessToken: string };
    }>({
      method: "POST",
      path: "/auth/register-merchant",
      body: {
        email,
        password,
        fullName: "Lifecycle Owner",
        storeName: "Lifecycle Store",
        storeSlug
      }
    });

    userId = registration.body.user.id;
    storeId = registration.body.store.id;
    token = registration.body.tokens.accessToken;
  });

  after(async () => {
    if (storeId) {
      await prisma.store.delete({
        where: { id: storeId }
      });
    }

    if (userId) {
      await prisma.user.delete({
        where: { id: userId }
      });
    }

    await app.close();
  });

  it("covers registration, dns retry, activation and storefront fallback for a custom domain", async () => {
    const creation = await requestJson<{
      domain: {
        id: string;
        host: string;
        status: string;
        dnsTargetValue: string | null;
      };
    }>({
      method: "POST",
      path: "/domains",
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        storeId,
        host: customHost
      }
    });

    assert.equal(creation.statusCode, 201);
    assert.equal(creation.body.domain.host, customHost);
    assert.equal(creation.body.domain.status, "AWAITING_DNS");

    const conflict = await requestJson<{
      message: string;
      code: string;
      host: string;
    }>({
      method: "POST",
      path: "/domains",
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {
        storeId,
        host: customHost
      }
    });

    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.body.code, "DOMAIN_HOST_ALREADY_IN_USE");

    const createdDomainId = creation.body.domain.id;
    const expectedDnsTarget = creation.body.domain.dnsTargetValue;

    await domainsService.processDnsVerificationJob(createdDomainId);

    const pendingDomain = await requestJson<{
      domain: {
        id: string;
        status: string;
        dnsConfiguredValue: string | null;
        dnsErrorMessage: string | null;
      } | null;
    }>({
      path: `/domains/${storeId}`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(pendingDomain.statusCode, 200);
    assert.equal(pendingDomain.body.domain?.status, DomainStatus.AWAITING_DNS);
    assert.equal(pendingDomain.body.domain?.dnsConfiguredValue, "wrong-target.example.com");
    assert.match(pendingDomain.body.domain?.dnsErrorMessage ?? "", /CNAME mismatch/);

    const unresolvedCustomHost = await requestJson<{
      kind: string;
      matchedHost: string;
    }>({
      path: "/domains/resolve",
      headers: {
        host: customHost
      }
    });

    const fallbackSubdomain = await requestJson<{
      kind: string;
      matchedHost: string;
      storeId: string;
      storeSlug: string;
      source: string;
    }>({
      path: "/domains/resolve",
      headers: {
        host: fallbackHost
      }
    });

    assert.deepEqual(unresolvedCustomHost.body, {
      kind: "unknown",
      matchedHost: customHost
    });
    assert.deepEqual(fallbackSubdomain.body, {
      kind: "storefront-store",
      matchedHost: fallbackHost,
      storeId,
      storeSlug,
      source: "subdomain"
    });

    currentDnsTarget = expectedDnsTarget ?? "";
    await domainsService.processDnsVerificationJob(createdDomainId);

    const sslPendingDomain = await prisma.storeDomain.findUniqueOrThrow({
      where: { id: createdDomainId }
    });

    assert.equal(sslPendingDomain.status, DomainStatus.SSL_PENDING);
    assert.equal(sslPendingDomain.dnsConfiguredValue, expectedDnsTarget);
    assert.ok(sslPendingDomain.dnsVerifiedAt instanceof Date);

    await domainsService.processSslProvisioningJob(createdDomainId);

    const provisionedDomain = await prisma.storeDomain.findUniqueOrThrow({
      where: { id: createdDomainId }
    });

    assert.equal(provisionedDomain.status, DomainStatus.SSL_PENDING);
    assert.equal(provisionedDomain.sslProvisioningId, `mock-${createdDomainId}`);

    currentSslStatus = "active";
    await domainsService.processSslStatusSyncJob(createdDomainId);

    const activeDomain = await prisma.storeDomain.findUniqueOrThrow({
      where: { id: createdDomainId }
    });

    assert.equal(activeDomain.status, DomainStatus.ACTIVE);
    assert.ok(activeDomain.activatedAt instanceof Date);

    const resolvedCustomHost = await requestJson<{
      kind: string;
      matchedHost: string;
      storeId: string;
      storeSlug: string;
      source: string;
    }>({
      path: "/domains/resolve",
      headers: {
        host: customHost
      }
    });

    assert.equal(resolvedCustomHost.statusCode, 200);
    assert.deepEqual(resolvedCustomHost.body, {
      kind: "storefront-store",
      matchedHost: customHost,
      storeId,
      storeSlug,
      source: "custom-domain"
    });
  });

  async function requestJson<T>(options: RequestOptions): Promise<JsonResponse<T>> {
    const payload = options.body ? JSON.stringify(options.body) : undefined;

    return new Promise((resolve, reject) => {
      const request = http.request(
        `${baseUrl}${options.path}`,
        {
          method: options.method ?? "GET",
          headers: {
            "content-type": "application/json",
            ...(payload ? { "content-length": Buffer.byteLength(payload).toString() } : {}),
            ...(options.headers ?? {})
          }
        },
        (response) => {
          const chunks: Buffer[] = [];

          response.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
          });

          response.on("end", () => {
            const rawBody = Buffer.concat(chunks).toString("utf8");
            const body = rawBody.length > 0 ? (JSON.parse(rawBody) as T) : ({} as T);

            resolve({
              statusCode: response.statusCode ?? 0,
              body
            });
          });
        }
      );

      request.on("error", reject);

      if (payload) {
        request.write(payload);
      }

      request.end();
    });
  }
});
