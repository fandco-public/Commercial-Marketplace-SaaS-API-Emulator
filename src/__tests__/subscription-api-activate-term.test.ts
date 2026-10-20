import moment from 'moment';
import { activateApi } from '../subscription-api-impl';
import { ServicesContainer } from '../services/container';
import { mockResponse } from '../testHelpers/helpers';
import { RequestWithPublisher, Subscription } from '../types';

// Regression guard for the term dates set by activate.
//
// moment's add() mutates in place and returns the same object, so
//   const end = start.add(unit)
// leaves `start` and `end` pointing at the same, advanced moment. The start
// date then lands one whole term in the future and any "is this subscription
// in term?" check is wrong. Observed before the fix: a subscription activated
// on 20 October carried startDate AND endDate of 20 November.

describe('Activate term date tests', () => {
  const buildSubscription: () => Subscription = () =>
    ({
      id: 'sub-1',
      publisherId: 'FourthCoffee',
      offerId: 'flat-rate',
      planId: 'flat-rate-1',
      name: 'term test',
      saasSubscriptionStatus: 'PendingFulfillmentStart',
      term: { termUnit: 'P1M' }
    } as any as Subscription);

  const activate: (
    subscription: Subscription
  ) => Promise<void> = async (subscription) => {
    const req: Partial<RequestWithPublisher> = {
      publisherId: 'FourthCoffee',
      params: { subscriptionId: subscription.id },
      body: { planId: subscription.planId },
      query: {}
    };

    const services: Partial<ServicesContainer> = {
      stateStore: {
        getSubscriptionAsync: jest.fn().mockReturnValue(Promise.resolve(subscription)),
        updateSubscriptionAsync: jest.fn().mockReturnValue(Promise.resolve()),
        getPlansForOfferAsync: jest.fn().mockReturnValue(Promise.resolve({}))
      },
      notifications: {
        sendError: jest.fn(),
        sendMessage: jest.fn(),
        sendWarning: jest.fn(),
        sendUpdate: jest.fn(),
        upgradeConnection: jest.fn()
      },
      logger: { log: jest.fn() }
    } as any as Partial<ServicesContainer>;

    const { res } = mockResponse();

    await activateApi(req as RequestWithPublisher, res, services as ServicesContainer);
  };

  it('Sets the term start date to now, not one term ahead', async () => {
    // Arrange
    //
    const subscription = buildSubscription();
    const before = moment();

    // Act
    //
    await activate(subscription);

    // Assert
    //
    const start = moment(subscription.term.startDate);

    // The start date must be now, within a generous window for test latency.
    expect(Math.abs(start.diff(before, 'seconds'))).toBeLessThan(60);

    // And emphatically not a month ahead, which is the defect.
    expect(start.isBefore(before.clone().add('P1M').subtract(1, 'day'))).toBe(true);
  });

  it('Sets the term end date one term after the start date', async () => {
    // Arrange
    //
    const subscription = buildSubscription();

    // Act
    //
    await activate(subscription);

    // Assert
    //
    const start = moment(subscription.term.startDate);
    const end = moment(subscription.term.endDate);

    expect(end.isAfter(start)).toBe(true);
    expect(end.diff(start, 'days')).toBeGreaterThan(27);
    expect(end.diff(start, 'days')).toBeLessThan(32);
  });

  it('Does not set the two dates to the same instant', async () => {
    // The precise symptom of the defect: both names referenced one object.

    // Arrange
    //
    const subscription = buildSubscription();

    // Act
    //
    await activate(subscription);

    // Assert
    //
    expect(subscription.term.startDate).not.toEqual(subscription.term.endDate);
  });
});
