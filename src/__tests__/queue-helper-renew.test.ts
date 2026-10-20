import moment from 'moment';
import { queueSubscriptionUpdate } from '../helpers/queue-helper';
import { ServicesContainer } from '../services/container';
import { Operation, Subscription } from '../types';

// Renew previously did nothing. The emulator accepted the operation, fired a
// webhook, reported success, and left the subscription byte-identical - so a
// consumer testing its own Renew handler had nothing to verify against.
//
// The behaviour asserted here is INFERRED, not observed against the real
// marketplace: the new term begins where the old one ended and runs for one
// more termUnit. These tests pin that assumption so it cannot drift silently.

describe('Queue helper renew tests', () => {
  const termStart = '2026-01-20T10:00:00.000Z';
  const termEnd = '2026-02-20T10:00:00.000Z';

  const buildSubscription: (withEndDate?: boolean) => Subscription = (withEndDate = true) =>
    ({
      id: 'sub-renew',
      publisherId: 'FourthCoffee',
      offerId: 'flat-rate',
      planId: 'flat-rate-1',
      saasSubscriptionStatus: 'Subscribed',
      term: withEndDate
        ? { termUnit: 'P1M', startDate: new Date(termStart), endDate: new Date(termEnd) }
        : { termUnit: 'P1M' }
    } as any as Subscription);

  const renew: (subscription: Subscription) => Promise<{ save: jest.Mock; log: jest.Mock }> = async (
    subscription
  ) => {
    const operation: Operation = {
      id: 'op-1',
      publisherId: 'FourthCoffee',
      subscriptionId: subscription.id,
      action: 'Renew',
      status: 'Succeeded'
    } as any as Operation;

    const save = jest.fn();
    const log = jest.fn();

    const services: Partial<ServicesContainer> = {
      config: { subscriptionUpdateDelayMS: 0 },
      logger: { log },
      stateStore: {
        getSubscriptionAsync: jest.fn().mockReturnValue(Promise.resolve(subscription)),
        save
      },
      notifications: {
        sendError: jest.fn(),
        sendMessage: jest.fn(),
        sendWarning: jest.fn(),
        sendUpdate: jest.fn(),
        upgradeConnection: jest.fn()
      }
    } as any as Partial<ServicesContainer>;

    await queueSubscriptionUpdate(services as ServicesContainer, operation);

    // The update is deferred through setTimeout, so yield until it has run.
    for (let i = 0; i < 50; i++) {
      if (save.mock.calls.length > 0) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return { save, log };
  };

  it('Moves the term start to where the previous term ended', async () => {
    // Arrange
    //
    const subscription = buildSubscription();

    // Act
    //
    await renew(subscription);

    // Assert
    //
    expect(moment(subscription.term.startDate).toISOString()).toBe(termEnd);
  });

  it('Extends the term end by one term unit', async () => {
    // Arrange
    //
    const subscription = buildSubscription();

    // Act
    //
    await renew(subscription);

    // Assert
    //
    expect(moment(subscription.term.endDate).toISOString()).toBe('2026-03-20T10:00:00.000Z');
  });

  it('Does not leave the two dates identical', async () => {
    // Guards the clone(), without which add() would mutate the shared moment.

    // Arrange
    //
    const subscription = buildSubscription();

    // Act
    //
    await renew(subscription);

    // Assert
    //
    expect(subscription.term.startDate).not.toEqual(subscription.term.endDate);
  });

  it('Changes something at all', async () => {
    // The original defect: Renew reported success and changed nothing.

    // Arrange
    //
    const subscription = buildSubscription();
    const before = JSON.stringify(subscription);

    // Act
    //
    await renew(subscription);

    // Assert
    //
    expect(JSON.stringify(subscription)).not.toBe(before);
  });

  it('Logs rather than throwing when there is no term end date to renew from', async () => {
    // Arrange
    //
    const subscription = buildSubscription(false);

    // Act
    //
    const { log } = await renew(subscription);

    // Assert
    //
    expect(subscription.term.startDate).toBeUndefined();
    expect(log.mock.calls.some((c) => String(c[0]).includes('no term end date'))).toBe(true);
  });
});
