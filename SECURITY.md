# Security

This repository is a fork maintained by Freytag & Company, LLC. It contains two kinds of code, and
security reports go to different places depending on which kind is affected.

## Vulnerabilities in the modifications made by this fork

**Report these to [team@freytag.us](mailto:team@freytag.us).** Please do not open a public issue.

The modifications are listed in [NOTICE](./NOTICE) and described under *Fixes in this fork* in the
[README](./README.md#fixes-in-this-fork). They include changes to the bearer-token validation in
`src/check-token.ts`, so they are security-relevant. Freytag & Company, LLC is solely responsible
for them; Microsoft has not reviewed them.

Include the version or commit, steps to reproduce, and the impact you believe it has.

## Vulnerabilities in the original Microsoft code

Code inherited unchanged from the upstream repository remains Microsoft's, and Microsoft's own
process for its open-source repositories is the
[Microsoft Security Response Center](https://aka.ms/opensource/security/create-report)
(email [secure@microsoft.com](mailto:secure@microsoft.com)). **Be aware that Microsoft archived
the upstream repository in September 2026**, so a report there may not be acted on. You are
welcome to copy [team@freytag.us](mailto:team@freytag.us) so that this fork can carry a fix regardless.

## Scope and expectations

This emulator is a development tool intended to run on a developer's own machine or in a private
environment. It deliberately relaxes several controls to make local testing easy — see
*Limitations* in the README, in particular the `x-ignore-auth` bypass and
`NODE_TLS_REJECT_UNAUTHORIZED=0`. Those are documented behaviours, not vulnerabilities, but they
mean the emulator should not be exposed to untrusted networks.

Please do not report security vulnerabilities through public GitHub issues.
