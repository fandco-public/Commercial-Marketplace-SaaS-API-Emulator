import { Request } from 'express';
import { checkToken } from '../check-token';
import { ServicesContainer } from '../services/container';
import { expectStatus, mockResponse } from '../testHelpers/helpers';

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
});
