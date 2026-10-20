# Commercial Marketplace SaaS API Emulator — Freytag & Company, LLC fork

**This is a modified fork, maintained by Freytag & Company, LLC.** It was forked from Microsoft's
[Commercial-Marketplace-SaaS-API-Emulator](https://github.com/microsoft/Commercial-Marketplace-SaaS-API-Emulator),
which Microsoft archived in September 2026. **The modifications are the work and responsibility of
Freytag & Company, LLC. Microsoft has not reviewed, endorsed or supported them.** The original work
remains copyright Microsoft Corporation; the modifications are copyright Freytag & Company, LLC; both are under the MIT licence. See [NOTICE](./NOTICE).

This repository contains a Node.js implementation of an emulator for the Microsoft commercial marketplace SaaS Fulfillment APIs.

To make hosting the emulator as simple as possible, the repo includes a Dockerfile for a building a containerised version.

> ### About this fork
>
> Microsoft archived the upstream repository **in September 2026** without naming a successor.
> Archived repositories accept neither pull requests nor issues, so these fixes cannot be
> contributed back; this fork is the maintenance path.
>
> **Upstream `main` does not build.** The defects fixed here are listed under
> [Fixes in this fork](#fixes-in-this-fork) and in [NOTICE](./NOTICE). One of them changes a
> documented default; one implements behaviour Microsoft never documented.
>
> The instructions below are also corrected: upstream names four controls that do not exist
> in the interface (`Generate Token`, `Post to landing page`, `Activate subscription` and
> `Copy to clipboard`). The real ones are `Get it now`, `Continue`, `Activate Subscription`,
> and a `Copy` button inside the `View token` dialog.

## What challenges does this project address?

Integrating with the commercial marketplace has a few scaffolding requirements; a barrier to getting up and running quickly. The emulator breaks that dependency, allowing teams to start building for marketplace with zero friction. Specifically:

- Remove dependency on Partner Center
  - Partner Center onboarding and permissions can take some time to setup correctly. You can get started right away without waiting for this process.
  - Ordinarily, testing API flows against plans can only happen after they have been created in Partner Center. Emulated plans allow development to happen in parallel. Only final testing is required against Partner Center plans.
- Remove the AAD requirement
  - A SaaS transactable offer, or at least the integration with marketplace, must be built with AAD. The integration with the marketplace APIs requires the app to be registered in AAD and API calls are secured with OAuth2. Similarly, your landing page must support AAD SSO. The emulator removes these requirements to make it simpler (and quicker) to start implementing your integration flows.

## Design goals

- Keep things simple
- Implement the minimum required whilst being fully functional out of the box
- Be consistent with the **behaviour** of APIs, note differences from the documented behaviour
- Support both unauthenticated use for simplicity and authenticated use for closer fidelity with the marketplace APIs.
- Flexible implementation that offers multiple hosting options to suit the user
- Offer configuration options to tailor the behaviour
- Provide a UI to step through and visualise certain actions

## Getting started

The emulator is a Node.js application designed to be run as a Docker container for portability. Other hosting options are also possible. For more details see the relevant section:

- [Hosting the emulator](./docs/launching.md)
- [Configuring the emulator](./docs/config.md)
- [Usage scenarios](./docs/scenarios.md)

## Using the emulator

With the emulator running, you can connect to it using a browser and standard tools such as the [REST Client extension for VS Code](https://github.com/Huachao/vscode-restclient), [Postman](https://www.postman.com/) etc.

The URL and port will depend on [your chosen deployment method](./docs/launching.md). eg if you're running the emulator locally using `docker run`, you would likely connect on `http://localhost:8080`.

1. Run the emulator using your [chosen method](./docs/launching.md)
1. With a browser, connect to `http://<domain>:<port>` (domain, port depend on your run method)
   - You should be presented with a page for configuring a synthetic marketplace purchase token
1. In the left panel, click `Get it now` on an offer
   - Until you do, the right panel stays a placeholder reading *"Select an offer to the left to
     configure the purchase by clicking 'Get it now'"*. This step is easy to miss
   - Two sample offers ship: `flat-rate` and `per-seat` (shown as "Sample Flat Rate" and
     "Sample Per Seat"), each with Bronze, Silver and Gold plans. Quantity is only meaningful
     on the per-seat plans
1. Configure the purchase in the right panel
   1. (Optionally) adjust plan, quantity, beneficiary or purchaser (otherwise defaults are populated)
   1. `View JSON` shows the purchase record; `View token` shows the Base64 purchase token
1. You can now either
   1. Click `Continue` to use the emulator's built-in landing page to resolve & activate a subscription
   1. Exercise the APIs manually (eg using the VS Code REST client or Postman)

### Use the Emulator's built-in landing page

1. Click the `Continue` button on the Configure Purchase form
1. You will be taken to the emulator's built-in landing page
1. The purchase token is passed to the landing page as a query string parameter
1. When it loads, the landing page automatically calls the `resolve API` to decode the token
1. Key token properties are displayed on the page
1. Click the `Activate Subscription` button to call the `activate API`
1. You should see a message indicating a `200 OK` status response
1. A `Go to Subscriptions` button appears; the `Status` column should read `Subscribed`
   - Before activation the status is `PendingFulfillmentStart`, shown as "Pending"
   - `Qty` shows `-` on flat-rate plans: the property is absent, not zero

### A word about the Publisher ID

Subscriptions need to be associated with a publisher. In the marketplace, the publisher is derived using claims from the AAD bearer token used to authenticate.

For the emulator, to keep things simple, we removed the AAD requirement. Instead, you can define the Publisher ID in one of two ways:

1. A `publisherId` query string parameter. This is set to "FourthCoffee" as a default in the emulator
   1. To see an example of this in action, take a look at the sample REST calls: [subscriptions-apis.http](./rest_calls/subscription-apis.http)
   1. To modify this Publisher ID for the built-in emulator functions, set the `PUBLISHER_ID` environment variable
1. A Publisher ID constructed from the publisher tenant and app IDs.
   1. This is useful to mirror the behaviour of the marketplace. The tenant and app ID from the app registration you use to authenticate with the marketplace APIs will also work with the emulator
   1. To modify this Publisher ID for the built-in emulator functions, set the `PUBLISHER_TENANT_ID` and `PUBLISHER_APP_ID` environment variables. Set these to the tenant and app ID from the app registration used to authenticate with the marketplace APIs. eg from the Azure Portal (see below) or Partner Center offer page.

   ![Screenshot of tenant id and app id](./docs/images/readme-publisherid-1.png)

You can use either approach (but not both at the same time!). The former is useful for early testing as you don't need to register with AAD, the latter is useful in the latter stages of emulator testing as it is directly compatible with the marketplace.

For more information on configuration see [Configuring the emulator](./docs/config.md)

### A word about ports, and who dials which address

The two URL settings are dialled by *different machines*, which is the single most common
source of confusion when running in Docker.

| Setting | Dialled by | So it must be reachable from |
|---|---|---|
| `LANDING_PAGE_URL` | Your **browser** | The host. Use the **published** port, or leave it unset (the default is relative) |
| `WEBHOOK_URL` | The **emulator**, inside the container | The container. Use `host.docker.internal:<port>` for your own service, or the container's own port for the built-in one |

With `docker run -p 8080:80`, port 8080 exists on the host only and port 80 inside only.
Getting this backwards gives you one of two errors:

- A landing page address using the container port produces a **404 from whatever owns that
  port on your host** — often IIS on Windows.
- A webhook address using the published port produces
  `ECONNREFUSED ... address: "::1", port: 8080` in the emulator log, because nothing listens
  there inside the container.

**Both defaults are correct as shipped in this fork**, so the simplest advice is to set
neither until you are pointing the emulator at your own service.

Note that a failed webhook does **not** prevent the subscription changing. The emulator's own
record still updates — a suspend still shows `Suspended` — because the marketplace side of the
transaction succeeded. Only the notification failed. In production that is the difference
between a cancelled customer losing access and keeping it, so the notification is the half
worth proving.


### Exercise the APIs manually

1. Click `View token`, then `Copy` in the dialog that opens (**not** `View JSON`, which
   shows the readable purchase record rather than the token)
1. This copies the Base64 encoded purchase token to the clipboard
1. Call the `resolve API` to resolve (decode) the purchase token
   1. This repo includes helpers to call the emulated APIs using the REST Client extension for VS Code
   1. Open this repo in VS Code
   1. Install the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)
   1. Open [subscription-apis.http](rest_calls/subscription-apis.http) from the `\rest_calls` folder
   1. In `subscription-apis.http` set
      - `publisherId [string]` simulates the Publisher ID (can be anything you like eg Contoso Corp)
      - `baseUrl [sting]` format as above eg `http://localhost:8080`
      - `purchaseToken [string]` the Base64 encoded purchase token (paste from the clipboard)
   1. Click `Send Request` (under ### Resolve)
      - You should see a Response appear with a `200 OK` status
      - The payload will include the decoded purchase token
1. Call the `activate API` to activate the purchase
   1. In `subscription-apis.http`
   1. Update the `planId` on the `activate` request to **match a valid planId** as set in the purchase token
   1. Click on `Send Request` on the `activate API` call
   1. You should see a `200 OK` status
   1. The payload will be `OK`

At this point you have

- Created a (synthetic) purchase token
- Resolved that purchase token to its properties
- Activated the purchase

You can now call other APIs to see their response

- eg the `GetSubscriptions` API would return a list of all subscriptions
- Having completed the above steps, this will return a collection with one item, the subscription you activated

There are helpers for all available SaaS Fulfillment v2 APIs in

- [subscription-apis.http](rest_calls/subscription-apis.http)
- [operations-apis.http](rest_calls/operations-apis.http)

For more details on the available APIs and their operation, see

- [SaaS subscription life cycle](https://learn.microsoft.com/azure/marketplace/partner-center-portal/pc-saas-fulfillment-life-cycle)
- [Subscription APIs](https://learn.microsoft.com/azure/marketplace/partner-center-portal/pc-saas-fulfillment-subscription-api)
- [Operations APIs](https://learn.microsoft.com/azure/marketplace/partner-center-portal/pc-saas-fulfillment-operations-api)

## Fixes in this fork

Four defects, each reproduced before being fixed and verified after. Upstream `main` carries
all four.

### 1 — The Docker build fails

`docker/Dockerfile` ran `RUN npm install -g npm` with no version pinned, so the build asked the
registry for whatever was current. The base image is pinned to Node 18; current npm requires
Node 22 or later, so the build died with `EBADENGINE`.

No npm above the one already in the image can run on it — npm 10 needs `^18.17.0`, npm 11 needs
`^20.17.0`, npm 12 needs `^22.22.2` — and `node:18-alpine3.16` ships Node 18.16.0 with npm
9.5.1. There is no version to pin to, so the line is removed. Nothing required it: there is no
`engines` field in `package.json`, and `package-lock.json` is `lockfileVersion: 2`, which npm 9
reads natively.

**Bumping the base image is not a fix.** One fork took that route in January 2026 and its build
broke again nine months later, because the unpinned upgrade simply caught up with the newer
Node. Removing the line removes the mechanism.

Also in this fix: `jest.config.json` is now copied into the image, which previously shipped
jest, ts-jest and the TypeScript compiler but could not invoke them — without the config, jest
falls back to `babel-jest` and cannot parse TypeScript. And `pull-request.yml` now builds the
image, which it never did; that is why this defect went unnoticed for eighteen months.

### 2 — `REQUIRE_AUTH=true` rejects every valid client

`checkToken` read `req.headers.authentication`. The header that carries bearer credentials is
`Authorization` (RFC 9110, RFC 6750); there is no standard `Authentication` request header. So
every correctly-behaving client received a 401.

The rest of the repository already disagreed with that line five to one, and `extract-publisher`
runs first on the same request, reads the `Authorization` header successfully to derive the
publisher id, and only then does `checkToken` report that no credentials were supplied.

`src/__tests__/check-token.test.ts` is added — the first test for this middleware, whose absence
is why a one-word typo shipped.

### 3 — An unresolvable signing key terminates the process

With `REQUIRE_AUTH=true`, a token whose signing key could not be resolved killed the emulator:

```
TypeError: Cannot read properties of undefined (reading 'publicKey')
```

The signing-key callback discarded its error argument and then dereferenced the key, throwing
inside an async callback with no handler. Reproduced two ways: an unreachable JWKS endpoint, and
a `kid` absent from a reachable key set.

Both failure modes are now handled. A failed key lookup returns **500**, not 403 — nothing was
authorized or denied, because no check completed, and reporting 403 sends an operator hunting a
token problem when the endpoint is simply unreachable. An invalid token still returns 403.

Signing keys are also cached now. The client was constructed inside the per-request callback, so
every authenticated request made a fresh round trip to the identity provider.

> **Do not add `rateLimit` to the `jwks-rsa` options.** In jwks-rsa 3.0.1, `cache` and
> `rateLimit` together make `getSigningKey` fail with *"Unable to find a signing key that
> matches &lt;kid&gt;"* for keys that resolve fine with either option alone — which turns every
> valid token into a 500. It typechecks and passes unit tests; only an end-to-end test catches
> it. There is a comment to this effect in the source.

### 4 — The landing page default is wrong under Docker

The default was built from the container's own listening port:

```typescript
landingPageUrl: process.env.LANDING_PAGE_URL ?? `http://localhost:${port}/landing.html`
```

But that address is consumed by the **browser**, on the host. A container cannot know which host
port it was published on, so an absolute default can only be right when the two happen to match.
With `-p 8080:80` it pointed at host port 80 and failed.

**This fork defaults to `/landing.html` — relative.** The browser resolves it against the
emulator's own origin, so it is correct at any published port. Upstream's `docs/config.md` still
documents the absolute form; that is why the two disagree.

The webhook default has the identical shape and is **correct**, because the emulator dials that
one itself, from inside, where `port` really is the listening port.

Two supporting changes: `postToLanding` now treats a path beginning with `/` as same-origin and
navigates rather than opening a new tab, and the config endpoint accepts a relative
`landingPageUrl`. The webhook must still be fully qualified, since a relative path is meaningless
server side.

### 5 — Activate sets the wrong subscription term start date

`activate` set both term dates to the same instant, one whole term in the future. A
subscription activated on 20 October carried:

```json
"term": { "termUnit": "P1M",
           "startDate": "2026-11-20T17:17:18.885Z",
           "endDate":   "2026-11-20T17:17:18.885Z" }
```

Cause: moment's `add()` mutates in place and returns the same object, so

```typescript
const now = moment();
const endMoment = now.add(subscription.term.termUnit);
```

leaves `endMoment` and `now` as one object. By the time `startDate` was assigned, `now` had
already advanced a term. `endDate` was correct by accident; `startDate` was a month out, and the
two were always identical. Fixed with `clone()`.

This one produced **wrong data** rather than a crash or a refusal, which is why it went
unnoticed. It matters to any consumer that records the term, or asks whether a subscription is
currently within it — a start date in the future makes that check wrong for the whole first
term.

The pre-existing `TODO` above that block is untouched: the term unit is still taken verbatim
from the plan rather than derived.

### 6 — Renew did nothing, and reported success

`queue-helper.ts` carried:

```typescript
case 'Renew':
  // ?
  break;
```

A renewal was accepted, fired a webhook, logged `Operation Succeeded` and left the
subscription byte-identical. A silent no-op reported as success is worse than an honest gap:
a consumer testing its own Renew handler has nothing to verify against, and the interface
says it worked.

**The new behaviour is inferred, not observed.** Microsoft does not document what a renewal
does to the term, which is presumably why the case was left empty. The assumption taken here
is the natural reading: the new term begins where the old one ended and runs for one more
`termUnit`. The source comment says so explicitly, so nobody later mistakes it for documented
behaviour. **Verify it against the real marketplace API before relying on it.**

A subscription with no term end date — never activated — is logged rather than silently
skipped. `clone()` is used for the same reason as in fix 5.

## Functionality


The solution emulates all operations on the [SaaS Fulfillment APIs v2](https://learn.microsoft.com/azure/marketplace/partner-center-portal/pc-saas-fulfillment-life-cycle) closely. It is close-to, but not 100% fidelity (see [Limitations](#limitations) below.

Any solution should be [thoroughly tested against the marketplace APIs](https://learn.microsoft.com/azure/marketplace/test-saas-overview) before final release.

Capabilities include the following:

- Generate a synthetic [purchase identification token](https://learn.microsoft.com/azure/marketplace/partner-center-portal/pc-saas-fulfillment-subscription-api#resolve-a-purchased-subscription)
- This token has customisable subscription properties that can be resolved by the emulated `resolve` API
- Publisher ID can be set by query string parameter (`publisherId`) or authorization header (bearer token)
- Testing the following flows:
  - Landing page flow
  - Activation flow
  - Update flow (change plan, change quantity)
  - Suspend and reinstate flow
  - Unsubscribe flow
  - Renew flow — **in this fork only.** Upstream accepted a renewal and changed nothing;
    see fix 6 below. The behaviour is inferred rather than documented by Microsoft
  - Webhook flows

The format of the marketplace [purchase identification token](https://learn.microsoft.com/azure/marketplace/partner-center-portal/pc-saas-fulfillment-subscription-api#resolve-a-purchased-subscription) is not documented. In the emulator, this has been simulated with a Base64 encoded JSON payload.

## Limitations

- The activate call does not validate the publisher (as the 'faux' purchase token isn't associated with a specific publisher. This may be implemented in future.
- **Metered billing is not emulated at all.** There is no `usageEvent` or `batchUsageEvent`
  endpoint; `meteringDimensions` exists on the offer model as an empty placeholder. If your offer
  prices per usage, that path cannot be tested here.
- **`x-ignore-auth` is a complete authentication bypass.** Any request carrying that header, with
  any value, skips token checking even when `REQUIRE_AUTH=true`. The emulator's own UI depends on
  it (`src/client/core.js`), because a static browser page cannot perform a client-credentials
  token exchange. Harmless on localhost; worth knowing before exposing an instance to anything
  else.
- **The emulator sends no bearer token to your webhook** unless `CLIENT_ID`, `CLIENT_SECRET` and
  `TENANT_ID` are configured. So your webhook's own token validation — the boundary that stops
  anyone on the internet cancelling your customers' subscriptions — is **not** exercised by
  default. Configure those three, or test that code separately.
- **The built-in webhook does not confirm operations.** It acknowledges with 200 and skips the
  `PATCH` unless `INTERNAL_PATCH_RESULT` is set, so asynchronous operations wait out
  `WEBHOOK_CALL_PATCH_DELAY` (default 10 seconds) before the emulator proceeds on its own. That
  pause is the window your real service gets to respond, so it is realistic rather than slow.
- The emulator sets `NODE_TLS_REJECT_UNAUTHORIZED = "0"`, so it accepts **any** certificate on
  outbound calls, hostname checks included. Convenient for self-signed development certificates;
  it also means "tested over HTTPS" proves less here than it sounds.

## Accelerator Integration

There are two Open Source projects from teams at Microsoft, the SaaS Accelerator and MONA SaaS that have been updated to work with the Emulator in place of the Azure Marketplace. Documentation: [Integrations](/docs/integration.md).

## Contributing

Contributions to this fork are welcome through this repository's issues and pull requests, and
are accepted under the MIT licence. Microsoft's Contributor License Agreement does **not** apply
here: that process belonged to the upstream repository, which is archived and accepts nothing.

This fork adopts the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/)
by reference. Questions or concerns about conduct in *this* repository go to
[team@freytag.us](mailto:team@freytag.us), not to Microsoft — see [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft
trademarks or logos is subject to and must follow
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.
