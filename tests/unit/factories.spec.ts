import { test, expect } from '@playwright/test';
import { buildCustomer, buildPayee } from '../../src/data/factories';

test.describe('data factories @unit', () => {
  test('builds unique customers with application-safe defaults', () => {
    const first = buildCustomer();
    const second = buildCustomer();

    expect(first.username).not.toBe(second.username);
    expect(first.firstName).not.toBe(second.firstName);
    expect(first.ssn).toMatch(/^\d{3}-\d{2}-\d{4}$/);
    expect(first.zipCode).toMatch(/^\d{5}$/);
    expect(first.phoneNumber).toMatch(/^\d{10}$/);
    expect(first.street).toMatch(/^\d{1,4} Automation Way$/);
  });

  test('applies explicit overrides without changing unrelated fields', () => {
    const customer = buildCustomer({ city: 'Boundary City', phoneNumber: '' });

    expect(customer.city).toBe('Boundary City');
    expect(customer.phoneNumber).toBe('');
    expect(customer.username).toMatch(/^qa\d+$/);
  });

  test('builds a payee with numeric account and contact fields', () => {
    const payee = buildPayee();

    expect(payee.accountNumber).toMatch(/^\d{5}$/);
    expect(payee.zipCode).toMatch(/^\d{5}$/);
    expect(payee.phoneNumber).toMatch(/^\d{10}$/);
  });
});
