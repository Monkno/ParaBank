/** The registration form, field for field. `password` is not part of the
 *  customer record the API returns — it is what the suite typed. */
export interface Customer {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  ssn: string;
  username: string;
  password: string;
}

/** `GET /services_proxy/bank/customers/{id}` — note there is no username or password field. */
export interface CustomerRecord {
  id: number;
  firstName: string;
  lastName: string;
  address: { street: string; city: string; state: string; zipCode: string };
  phoneNumber: string;
  ssn: string;
}

export type AccountType = 'CHECKING' | 'SAVINGS' | 'LOAN';

/** `GET /services_proxy/bank/accounts/{id}` — `balance` is a JSON number of dollars. */
export interface Account {
  id: number;
  customerId: number;
  type: AccountType;
  balance: number;
}

/** `GET /services_proxy/bank/accounts/{id}/transactions` */
export interface Transaction {
  id: number;
  accountId: number;
  type: 'Debit' | 'Credit';
  /** Epoch millis at UTC midnight of the booking day. */
  date: number;
  amount: number;
  description: string;
}

/** The Bill Pay payee form. */
export interface Payee {
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  accountNumber: string;
}
