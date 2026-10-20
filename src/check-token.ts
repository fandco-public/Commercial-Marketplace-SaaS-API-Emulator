import { Request, Response, NextFunction } from 'express';
import jwt, { GetPublicKeyOrSecret, JwtPayload } from 'jsonwebtoken';
import { ServicesContainer } from './services/container';
import jwksClient from 'jwks-rsa';
import { MarketplaceResource } from './types';

// jsonwebtoken wraps anything thrown by the signing-key callback with this
// text and discards the original error, so matching the message is the only
// way to tell "the key could not be fetched" from "the token is invalid".
const keyCallbackErrorPrefix = 'error in secret or public key callback';

// One client per JWKS endpoint, reused across requests so that keys are
// cached. Constructing a client inside the per-request callback gave every
// request an empty cache and a fresh round trip to the identity provider.
const clients = new Map<string, jwksClient.JwksClient>();

const clientFor: (jwksUri: string) => jwksClient.JwksClient = (jwksUri) => {
  let client = clients.get(jwksUri);

  if (client === undefined) {
    // Do NOT add rateLimit here. In jwks-rsa 3.0.1, combining cache with
    // rateLimit makes getSigningKey fail with "Unable to find a signing key
    // that matches <kid>" for keys that resolve fine with either option on
    // its own - which would turn every valid token into a 500. Caching alone
    // already removes the per-request round trip that rateLimit guarded.
    client = jwksClient({
      jwksUri,
      cache: true,
      cacheMaxAge: 600000
    });

    clients.set(jwksUri, client);
  }

  return client;
};

const getSigningKeyCallback: (jwksUri: string) => GetPublicKeyOrSecret = (jwksUri) => {
  const getSigningKey: GetPublicKeyOrSecret = (header, callback) => {
    clientFor(jwksUri).getSigningKey(header.kid, (err, key) => {
      // Both of these were previously unhandled: the error was discarded as
      // '_' and an undefined key was dereferenced, throwing inside an async
      // callback with no handler and terminating the process.
      if (err !== null && err !== undefined) {
        callback(err);
        return;
      }

      if (key === undefined) {
        callback(new Error(`No signing key found for kid ${header.kid}`));
        return;
      }

      // Declared on both CertSigningKey and RsaSigningKey, so this needs no
      // narrowing and no casts.
      callback(null, key.getPublicKey());
    });
  };

  return getSigningKey;
}

export const checkToken = (services: ServicesContainer) => (req: Request, res: Response, next: NextFunction) => {

  if (services.config.requireAuth !== true || req.headers['x-ignore-auth'] !== undefined) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (authHeader === undefined) {
      return res.sendStatus(401);
  }

  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return res.sendStatus(401);
  }

  const token = authHeader.split(" ")[1];
  
  const decoded = jwt.decode(token);

  if (decoded === null) {
    return res.sendStatus(401);
  }

  const tenantId = (decoded as JwtPayload).tid as (string | undefined);

  if (tenantId === undefined) {
    return res.sendStatus(403);
  }

  const validationOptions = {
    audience: MarketplaceResource,
    issuer: `https://sts.windows.net/${tenantId}/`,
    clockTolerance: 5
  };

  jwt.verify(token, getSigningKeyCallback(`https://login.microsoftonline.com/${tenantId}/discovery/keys`), validationOptions, (err) => {
    if (err !== null) {
      // A failed key lookup is an inability to check, not a rejection of the
      // caller. Reporting 403 for it sends an operator hunting a token
      // problem when the real cause is an unreachable JWKS endpoint.
      if (err.message.startsWith(keyCallbackErrorPrefix)) {
        console.error(`[checkToken] cannot validate token: ${err.message}`);
        return res.sendStatus(500);
      }

      console.error(`[checkToken] token rejected: ${err.name}: ${err.message}`);
      return res.sendStatus(403);
    }

    next();
  })
};
