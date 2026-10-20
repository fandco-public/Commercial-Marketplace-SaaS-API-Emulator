# Emulator Scenarios

Depending where you are in your SaaS transaction journey, you may or may not have all the components required to run the transact flow end-to-end in your own solution. The emulator has built-in landing page and webhook implementations for you to use as an interim. The various scenarios are detailed below:

## Scenario 1 - Out-Of-Box experience (default configuration)

![Pre-configured](images/scenario-pre-configured-mid.png)

**Note:** In this fork the landing page default is the relative path `/landing.html`, which the
browser resolves against whatever address it reached the emulator on. So hosting the emulator
somewhere other than localhost - an Azure App Service, say - needs no change: navigating to
"{host-address}/landing.html" works by itself.

Set an absolute value only if the browser must be sent somewhere other than the emulator's own
origin, which is Scenario 2. (Upstream's default was absolute and did have to be reconfigured
for any non-localhost host.)

## Scenario 2 - ISV hosted landing page

If you have built a landing page, or are in the process of building and would like to test the _resolve_ and _activate_ API calls, the emulator can be configured to launch your landing page after an emulated purchase.

![Custom landing page](images/scenario-custom-landing-page-mid.png)

This configuration value can be set through the UI: Navigate to the emulator user interface, select _config_, set the _Landing Page URL_ and click _set_.

![Custom landing page ui config](images/scenario-custom-landing-page-config.png)

**Note:** Changing the value through the user interface will only persist the new value for the duration of the session. If the emulator is restarted, this value will be lost and will need to be reconfigured.

To make this value persistent across restarts, set the environment variable `LANDING_PAGE_URL` instead.

## Scenario 3 - ISV hosted landing page and webhook

![Custom webhook](images/scenario-custom-webhook-mid.png)

This scenario is Scenario 2 **plus** your own webhook, so set the _Landing Page URL_ as above
and the _Webhook URL_ as well.

The webhook configuration value can be set through the UI: Navigate to the emulator user
interface, select _config_, set the _Webhook URL_ and click _set_.

**Mind which machine dials which address.** The landing page is opened by your browser, so it
must be reachable from there. The webhook is called by the emulator itself, so it must be
reachable from wherever the emulator runs - if the emulator is in a container and your service
is on the Docker host, that means `host.docker.internal:<port>`, not `localhost`.

![Custom webhook ui config](images/scenario-custom-webhook-config.png)

**Note:** Changing the value through the user interface will only persist the new value for the duration of the session. If the emulator is restarted, this value will be lost and will need to be reconfigured.

To make this value persistent across restarts, set the environment variable `WEBHOOK_URL` instead.
