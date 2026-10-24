import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNFS from '@dr.pogodin/react-native-fs';
import AccountService, { Transaction, TransactionType, UserAccount } from './AccountService';
import ProductService, { Product } from './ProductService';
import { cardLabel, formatDateTimeFull, formatFileTimestamp } from '../utils/format';

export interface BackupFile {
  name: string;
  path: string;
  modified: number;
  size: number;
}

interface BackupContent {
  app: 'semera-pay';
  version: 1;
  createdAt: number;
  accounts: UserAccount[];
  transactions: Transaction[];
  products?: Product[]; // fehlt in Sicherungen, die vor der Produktverwaltung erstellt wurden
}

const BACKUP_PREFIX = 'semera-pay-backup-';
const SAFETY_PREFIX = 'semera-pay-vorher-';
const LAST_BACKUP_KEY = '@semera_pay_last_backup';

const TYPE_LABELS: Record<TransactionType, string> = {
  sale: 'Verkauf',
  topup: 'Aufladung',
  reset: 'Zurückgesetzt',
};

const isAccount = (a: any): a is UserAccount =>
  a && typeof a.uid === 'string' && typeof a.name === 'string' && typeof a.balance === 'number' && typeof a.lastSync === 'number';

const isTransaction = (t: any): t is Transaction =>
  t && typeof t.id === 'string' && typeof t.uid === 'string' && typeof t.name === 'string' &&
  typeof t.amount === 'number' && typeof t.balanceAfter === 'number' && typeof t.description === 'string' &&
  typeof t.timestamp === 'number' && Object.prototype.hasOwnProperty.call(TYPE_LABELS, t.type);

const isProduct = (p: any): p is Product =>
  p && typeof p.id === 'string' && typeof p.catId === 'string' && typeof p.name === 'string' && typeof p.price === 'number';

// Text für eine CSV-Zelle: in Anführungszeichen, und Eingaben, die Excel als Formel lesen würde, entschärft
const csvText = (value: string) => `"${(/^[=+\-@]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;

// Betrag in Euro mit Komma, wie deutsches Excel es erwartet
const csvMoney = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

class BackupService {
  private async writeFile(name: string, content: string): Promise<string> {
    const path = `${RNFS.DocumentDirectoryPath}/${name}`;
    await RNFS.writeFile(path, content, 'utf8');
    return path;
  }

  private async writeBackup(prefix: string): Promise<string> {
    const { accounts, transactions } = await AccountService.exportData();
    const products = await ProductService.getProducts();
    const now = new Date();
    const content: BackupContent = {
      app: 'semera-pay',
      version: 1,
      createdAt: now.getTime(),
      accounts,
      transactions,
      products,
    };
    return this.writeFile(`${prefix}${formatFileTimestamp(now)}.json`, JSON.stringify(content, null, 2));
  }

  // Sicherung aller Karten und Buchungen als Datei im App-Ordner (in der Dateien-App sichtbar)
  async createBackup(): Promise<string> {
    const path = await this.writeBackup(BACKUP_PREFIX);
    await AsyncStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
    return path;
  }

  async getLastBackup(): Promise<number | null> {
    const value = await AsyncStorage.getItem(LAST_BACKUP_KEY);
    return value ? Number(value) : null;
  }

  // Alle Sicherungen im App-Ordner, neueste zuerst
  async listBackups(): Promise<BackupFile[]> {
    const items = await RNFS.readDir(RNFS.DocumentDirectoryPath);
    return items
      .filter(item => item.isFile() && item.name.startsWith('semera-pay-') && item.name.endsWith('.json'))
      .map(item => ({ name: item.name, path: item.path, modified: item.mtime?.getTime() ?? 0, size: item.size }))
      .sort((a, b) => b.modified - a.modified);
  }

  // Alle aktuellen Daten durch eine Sicherung ersetzen. Vorher wird der aktuelle Stand gesichert.
  async restoreBackup(path: string): Promise<void> {
    let data: any;
    try {
      data = JSON.parse(await RNFS.readFile(path, 'utf8'));
    } catch {
      throw new Error('Die Datei konnte nicht gelesen werden.');
    }
    if (
      data?.app !== 'semera-pay' ||
      !Array.isArray(data.accounts) || !data.accounts.every(isAccount) ||
      !Array.isArray(data.transactions) || !data.transactions.every(isTransaction) ||
      (data.products !== undefined && (!Array.isArray(data.products) || !data.products.every(isProduct)))
    ) {
      throw new Error('Das ist keine gültige Semera-Pay-Sicherung.');
    }

    await this.writeBackup(SAFETY_PREFIX);
    await AccountService.restoreData(data.accounts, data.transactions);
    if (data.products) await ProductService.saveProducts(data.products);
  }

  // CSV-Datei (Semikolon-getrennt, mit BOM) für Excel oder Numbers
  async exportCsv(kind: 'cards' | 'history'): Promise<string> {
    const { accounts, transactions } = await AccountService.exportData();
    const stamp = formatFileTimestamp(new Date());

    if (kind === 'cards') {
      const rows = [...accounts]
        .sort((a, b) => cardLabel(a.uid, a.name).localeCompare(cardLabel(b.uid, b.name)))
        .map(acc => [csvText(cardLabel(acc.uid, acc.name)), csvText(acc.uid), csvMoney(acc.balance), formatDateTimeFull(acc.lastSync)]);
      const lines = [['Name', 'Karten-ID', 'Guthaben', 'Zuletzt geändert'], ...rows].map(row => row.join(';'));
      return this.writeFile(`semera-pay-karten-${stamp}.csv`, `﻿${lines.join('\r\n')}\r\n`);
    }

    const rows = [...transactions]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(tx => [
        formatDateTimeFull(tx.timestamp),
        csvText(cardLabel(tx.uid, tx.name)),
        csvText(tx.uid),
        TYPE_LABELS[tx.type],
        csvText(tx.description),
        csvMoney(tx.amount),
        csvMoney(tx.balanceAfter),
      ]);
    const lines = [['Zeit', 'Karte', 'Karten-ID', 'Art', 'Beschreibung', 'Betrag', 'Stand danach'], ...rows].map(row => row.join(';'));
    return this.writeFile(`semera-pay-verlauf-${stamp}.csv`, `﻿${lines.join('\r\n')}\r\n`);
  }
}

export default new BackupService();
