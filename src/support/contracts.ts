import type { Account, AccountType, CustomerRecord, Transaction } from '../data/types';
import { ContractError } from './errors';

type JsonRecord = Record<string, unknown>;

function fail(endpoint: string, detail: string): never {
  throw new ContractError(`Contract mismatch from ${endpoint}: ${detail}`);
}

function record(value: unknown, endpoint: string, field = 'response'): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(endpoint, `${field} must be an object`);
  }
  return value as JsonRecord;
}

function finiteNumber(value: unknown, endpoint: string, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(endpoint, `${field} must be a finite number`);
  }
  return value;
}

function text(value: unknown, endpoint: string, field: string): string {
  if (typeof value !== 'string') {
    fail(endpoint, `${field} must be a string`);
  }
  return value;
}

function nullableText(value: unknown, endpoint: string, field: string): string | null {
  if (value === null) {
    return null;
  }
  return text(value, endpoint, field);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], endpoint: string, field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(endpoint, `${field} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function list<T>(value: unknown, endpoint: string, parse: (entry: unknown, location: string) => T): T[] {
  if (!Array.isArray(value)) {
    fail(endpoint, 'response must be an array');
  }
  return value.map((entry, index) => parse(entry, `${endpoint}[${index}]`));
}

export function parseAccount(value: unknown, endpoint: string): Account {
  const item = record(value, endpoint);
  return {
    id: finiteNumber(item.id, endpoint, 'id'),
    customerId: finiteNumber(item.customerId, endpoint, 'customerId'),
    type: oneOf<AccountType>(item.type, ['CHECKING', 'SAVINGS', 'LOAN'], endpoint, 'type'),
    balance: finiteNumber(item.balance, endpoint, 'balance'),
  };
}

export function parseAccounts(value: unknown, endpoint: string): Account[] {
  return list(value, endpoint, parseAccount);
}

export function parseCustomer(value: unknown, endpoint: string): CustomerRecord {
  const item = record(value, endpoint);
  const address = record(item.address, endpoint, 'address');
  return {
    id: finiteNumber(item.id, endpoint, 'id'),
    firstName: text(item.firstName, endpoint, 'firstName'),
    lastName: text(item.lastName, endpoint, 'lastName'),
    address: {
      street: text(address.street, endpoint, 'address.street'),
      city: text(address.city, endpoint, 'address.city'),
      state: text(address.state, endpoint, 'address.state'),
      zipCode: text(address.zipCode, endpoint, 'address.zipCode'),
    },
    phoneNumber: nullableText(item.phoneNumber, endpoint, 'phoneNumber'),
    ssn: text(item.ssn, endpoint, 'ssn'),
  };
}

export function parseTransaction(value: unknown, endpoint: string): Transaction {
  const item = record(value, endpoint);
  return {
    id: finiteNumber(item.id, endpoint, 'id'),
    accountId: finiteNumber(item.accountId, endpoint, 'accountId'),
    type: oneOf(item.type, ['Debit', 'Credit'] as const, endpoint, 'type'),
    date: finiteNumber(item.date, endpoint, 'date'),
    amount: finiteNumber(item.amount, endpoint, 'amount'),
    description: text(item.description, endpoint, 'description'),
  };
}

export function parseTransactions(value: unknown, endpoint: string): Transaction[] {
  return list(value, endpoint, parseTransaction);
}
