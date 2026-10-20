import { Request, Response } from 'express';
import jwksClient from 'jwks-rsa';
import { checkToken } from '../check-token';
import { ServicesContainer } from '../services/container';
import { expectStatus, mockResponse } from '../testHelpers/helpers';
import { MarketplaceResource } from '../types';

jest.mock('jwks-rsa');

// A token that jwt.decode() parses successfully but carries no tid claim.
// It therefore reaches the tid check and returns 403, which proves the
// Authorization header was read. It stops short of jwt.verify, so no
// network call to the JWKS endpoint is made.
const tokenWithoutTid =
  'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJub2JvZHkifQ.unusedsignature';

const servicesWith: (requireAuth: boolean) => ServicesContainer = (requireAuth) =>
  ({
    config: { requireAuth }
  } as any as ServicesContainer);

describe('Check token tests', () => {
  it.each([
    [false, undefined, undefined],
    [false, 'bearer ' + tokenWithoutTid, undefined],
    [true, undefined, 'true'],
    [true, 'bearer ' + tokenWithoutTid, 'true']
  ])(
    'Calls next middleware without checking the token',
    (requireAuth: boolean, authorization: string | undefined, ignoreAuth: string | undefined) => {
      // Arrange
      //
      const req: Partial<Request> = {
        headers: {
          authorization,
          'x-ignore-auth': ignoreAuth
        }
      };

      const { res, send, sendStatus } = mockResponse();

      const next = jest.fn();

      // Act
      //
      const middleware = checkToken(servicesWith(requireAuth));
      middleware(req as Request, res, next);

      // Assert
      //
      expect(next).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledTimes(0);
      expect(sendStatus).toHaveBeenCalledTimes(0);
    }
  );

  it.each([
    [undefined], // No Authorization header at all
    ['malformed token'], // Does not start with "bearer "
    ['bearer not-a-jwt'] // Starts with "bearer " but does not decode
  ])('Returns 401', (authorization: string | undefined) => {
    // Arrange
    //
    const req: Partial<Request> = {
      headers: {
        authorization
      }
    };

    const { res } = mockResponse();

    const next = jest.fn();

    // Act
    //
    const middleware = checkToken(servicesWith(true));
    middleware(req as Request, res, next);

    // Assert
    //
    expectStatus(res, 401);
    expect(next).toHaveBeenCalledTimes(0);
  });

  it('Reads the Authorization header, not Authentication', () => {
    // A bearer token in the standard Authorization header must be read. A
    // token without a tid claim then fails the tid check with 403. Getting
    // 401 instead would mean the header was never read - the defect this
    // test guards against.

    // Arrange
    //
    const req: Partial<Request> = {
      headers: {
        authorization: 'bearer ' + tokenWithoutTid
      }
    };

    const { res } = mockResponse();

    const next = jest.fn();

    // Act
    //
    const middleware = checkToken(servicesWith(true));
    middleware(req as Request, res, next);

    // Assert
    //
    expectStatus(res, 403);
    expect(next).toHaveBeenCalledTimes(0);
  });

  it('Ignores a token in the non-standard Authentication header', () => {
    // The mirror of the test above. Supplying the token only in the
    // non-standard header must not satisfy the check.

    // Arrange
    //
    const req: Partial<Request> = {
      headers: {
        authentication: 'bearer ' + tokenWithoutTid
      } as any
    };

    const { res } = mockResponse();

    const next = jest.fn();

    // Act
    //
    const middleware = checkToken(servicesWith(true));
    middleware(req as Request, res, next);

    // Assert
    //
    expectStatus(res, 401);
    expect(next).toHaveBeenCalledTimes(0);
  });

  // ---------------------------------------------------------------------
  // Signing-key resolution. Before the fix, an unresolvable key crashed the
  // process: the callback discarded its error and dereferenced an undefined
  // key, throwing inside an async callback with no handler.
  // ---------------------------------------------------------------------

  // Each test uses a distinct tenant id, because the module caches one client
  // per JWKS address and a shared address would reuse the previous mock.
  const tokenFor: (tenantId: string, kid: string) => string = (tenantId, kid) => {
    const encode = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url');

    return [
      encode({ alg: 'RS256', typ: 'JWT', kid }),
      encode({
        tid: tenantId,
        appid: 'appid',
        aud: MarketplaceResource,
        iss: `https://sts.windows.net/${tenantId}/`
      }),
      'forgedsignature'
    ].join('.');
  };

  const givenSigningKeyLookup: (behaviour: 'errors' | 'returnsNothing' | 'returnsKey') => void = (
    behaviour
  ) => {
    const getSigningKey = (kid: string, cb: (err: Error | null, key?: any) => void): void => {
      if (behaviour === 'errors') {
        cb(new Error('connect ETIMEDOUT 20.190.1.1:443'));
        return;
      }

      if (behaviour === 'returnsNothing') {
        cb(null, undefined);
        return;
      }

      cb(null, { kid, alg: 'RS256', getPublicKey: () => 'not-a-real-public-key' });
    };

    (jwksClient as unknown as jest.Mock).mockReturnValue({ getSigningKey });
  };

  const awaitStatus: (res: Response) => Promise<void> = async (res) => {
    for (let i = 0; i < 100; i++) {
      if ((res.sendStatus as jest.Mock).mock.calls.length > 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };

  it.each([
    ['errors' as const, 'tenant-lookup-errors'], // JWKS endpoint unreachable
    ['returnsNothing' as const, 'tenant-no-such-kid'] // kid not in the published set
  ])(
    'Returns 500 when the signing key cannot be resolved, and does not throw',
    async (behaviour: 'errors' | 'returnsNothing', tenantId: string) => {
      // Arrange
      //
      givenSigningKeyLookup(behaviour);

      const req: Partial<Request> = {
        headers: {
          authorization: 'bearer ' + tokenFor(tenantId, 'some-kid')
        }
      };

      const { res } = mockResponse();

      const next = jest.fn();

      // Act
      //
      const middleware = checkToken(servicesWith(true));
      middleware(req as Request, res, next);
      await awaitStatus(res);

      // Assert
      //
      // 500, not 403: we could not perform the check, so this is our failure
      // rather than a rejection of the caller.
      expectStatus(res, 500);
      expect(next).toHaveBeenCalledTimes(0);
    }
  );

  it('Returns 403 when the key resolves but the token is invalid', async () => {
    // Arrange
    //
    givenSigningKeyLookup('returnsKey');

    const req: Partial<Request> = {
      headers: {
        authorization: 'bearer ' + tokenFor('tenant-bad-signature', 'some-kid')
      }
    };

    const { res } = mockResponse();

    const next = jest.fn();

    // Act
    //
    const middleware = checkToken(servicesWith(true));
    middleware(req as Request, res, next);
    await awaitStatus(res);

    // Assert
    //
    expectStatus(res, 403);
    expect(next).toHaveBeenCalledTimes(0);
  });
});
