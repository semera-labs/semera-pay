import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserAccount {
  uid: string;      // Die NFC-Karten ID
  name: string;     // Name des Karteninhabers (leer, solange keiner vergeben ist)
  balance: number;  // Guthaben in Cent
  lastSync: number; // Zeitstempel der letzten Änderung
}

export type TransactionType = 'sale' | 'topup' | 'reset';

export interface Transaction {
  id: string;
  uid: string;
  name: string;         // Name zum Zeitpunkt der Buchung
  type: TransactionType;
  amount: number;       // Änderung des Guthabens in Cent (Verkauf und Zurücksetzen negativ, Aufladung positiv)
  balanceAfter: number; // Guthaben nach der Buchung in Cent
  description: string;
  timestamp: number;
}

export type TransactionResult =
  | { ok: true; account: UserAccount; transaction: Transaction }
  | { ok: false; balance: number };

class AccountService {
  private ACCOUNTS_KEY = '@semera_pay_accounts';
  private TRANSACTIONS_KEY = '@semera_pay_transactions';
  private queue: Promise<unknown> = Promise.resolve();

  // Schreibvorgänge nacheinander ausführen, damit sich zwei Buchungen nicht überschreiben
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async load<T>(key: string): Promise<T[]> {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  // Einen Account anhand der NFC-UID finden
  async getAccount(uid: string): Promise<UserAccount | null> {
    const accounts = await this.load<UserAccount>(this.ACCOUNTS_KEY);
    return accounts.find(acc => acc.uid === uid) || null;
  }

  // Für die Admin-Ansicht: Alle Accounts exportieren
  async getAllAccounts(): Promise<UserAccount[]> {
    return this.load<UserAccount>(this.ACCOUNTS_KEY);
  }

  // Buchungen, neueste zuerst; optional nur für eine Karte und begrenzt
  async getTransactions(uid?: string, limit?: number): Promise<Transaction[]> {
    const all = await this.load<Transaction>(this.TRANSACTIONS_KEY);
    const filtered = uid ? all.filter(tx => tx.uid === uid) : all;
    const newestFirst = filtered.reverse();
    return limit ? newestFirst.slice(0, limit) : newestFirst;
  }

  // Namen des Karteninhabers setzen (legt die Karte mit 0 Guthaben an, falls sie noch unbekannt ist).
  // Bisherige Buchungen mit dem alten Namen werden mit umbenannt; Buchungen aus der Zeit vor einem
  // Zurücksetzen der Karte behalten ihren damaligen Namen.
  setName(uid: string, name: string): Promise<UserAccount> {
    return this.enqueue(async () => {
      const accounts = await this.load<UserAccount>(this.ACCOUNTS_KEY);
      const transactions = await this.load<Transaction>(this.TRANSACTIONS_KEY);

      let account = accounts.find(acc => acc.uid === uid);
      if (!account) {
        account = { uid, name, balance: 0, lastSync: Date.now() };
        accounts.push(account);
      } else {
        const oldName = account.name;
        transactions.forEach(tx => {
          if (tx.uid === uid && tx.name === oldName && tx.type !== 'reset') tx.name = name;
        });
        account.name = name;
      }

      await AsyncStorage.setMany({
        [this.ACCOUNTS_KEY]: JSON.stringify(accounts),
        [this.TRANSACTIONS_KEY]: JSON.stringify(transactions),
      });
      return account;
    });
  }

  // Karte zurücksetzen: Guthaben auf 0 und Namen entfernen. Das Zurücksetzen wird im Verlauf vermerkt.
  resetAccount(uid: string): Promise<void> {
    return this.enqueue(async () => {
      const accounts = await this.load<UserAccount>(this.ACCOUNTS_KEY);
      const account = accounts.find(acc => acc.uid === uid);
      if (!account) return;

      const transactions = await this.load<Transaction>(this.TRANSACTIONS_KEY);
      const now = Date.now();
      transactions.push({
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        uid,
        name: account.name,
        type: 'reset',
        amount: -account.balance,
        balanceAfter: 0,
        description: 'Karte zurückgesetzt',
        timestamp: now,
      });

      account.balance = 0;
      account.name = '';
      account.lastSync = now;

      await AsyncStorage.setMany({
        [this.ACCOUNTS_KEY]: JSON.stringify(accounts),
        [this.TRANSACTIONS_KEY]: JSON.stringify(transactions),
      });
    });
  }

  // Karten und Buchungen für eine Sicherung auslesen
  exportData(): Promise<{ accounts: UserAccount[]; transactions: Transaction[] }> {
    return this.enqueue(async () => ({
      accounts: await this.load<UserAccount>(this.ACCOUNTS_KEY),
      transactions: await this.load<Transaction>(this.TRANSACTIONS_KEY),
    }));
  }

  // Alle Karten und Buchungen durch die Daten einer Sicherung ersetzen
  restoreData(accounts: UserAccount[], transactions: Transaction[]): Promise<void> {
    return this.enqueue(() =>
      AsyncStorage.setMany({
        [this.ACCOUNTS_KEY]: JSON.stringify(accounts),
        [this.TRANSACTIONS_KEY]: JSON.stringify(transactions),
      }),
    );
  }

  // Den gesamten Verlauf löschen; Karten und Guthaben bleiben unverändert
  clearTransactions(): Promise<void> {
    return this.enqueue(() => AsyncStorage.removeItem(this.TRANSACTIONS_KEY));
  }

  // Guthaben ändern (Verkauf: negativer Betrag, Aufladung: positiver Betrag) und die Buchung protokollieren.
  // Neue Karten werden beim ersten Aufladen automatisch angelegt. Das Guthaben darf nie unter 0 fallen.
  applyTransaction(
    uid: string,
    type: TransactionType,
    amount: number,
    description: string,
  ): Promise<TransactionResult> {
    return this.enqueue(async (): Promise<TransactionResult> => {
      const accounts = await this.load<UserAccount>(this.ACCOUNTS_KEY);
      const transactions = await this.load<Transaction>(this.TRANSACTIONS_KEY);

      let account = accounts.find(acc => acc.uid === uid);
      const balance = account ? account.balance : 0;
      if (balance + amount < 0) {
        return { ok: false, balance };
      }

      const now = Date.now();
      if (!account) {
        account = { uid, name: '', balance: 0, lastSync: now };
        accounts.push(account);
      }
      account.balance += amount;
      account.lastSync = now;

      const transaction: Transaction = {
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        uid,
        name: account.name,
        type,
        amount,
        balanceAfter: account.balance,
        description,
        timestamp: now,
      };
      transactions.push(transaction);

      // Guthaben und Protokoll in einem Schritt speichern
      await AsyncStorage.setMany({
        [this.ACCOUNTS_KEY]: JSON.stringify(accounts),
        [this.TRANSACTIONS_KEY]: JSON.stringify(transactions),
      });
      return { ok: true, account, transaction };
    });
  }
}

export default new AccountService();
