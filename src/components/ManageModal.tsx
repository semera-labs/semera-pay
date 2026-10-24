import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SEMERA_THEME } from '../constants/config';
import AccountService, { Transaction, UserAccount } from '../services/AccountService';
import { cardLabel, formatDateTime, formatMoney } from '../utils/format';
import { askName } from '../utils/prompt';
import BackupPanel from './BackupPanel';
import ProductsPanel from './ProductsPanel';

interface Props {
  visible: boolean;
  onClose: () => void;
  // Wird aufgerufen, wenn sich die Produktliste geändert hat (Bearbeiten oder Wiederherstellen einer Sicherung)
  onProductsChanged: () => void;
}

type Tab = 'cards' | 'history' | 'products' | 'backup';

const TABS: { key: Tab; title: string }[] = [
  { key: 'cards', title: 'KARTEN' },
  { key: 'history', title: 'VERLAUF' },
  { key: 'products', title: 'PRODUKTE' },
  { key: 'backup', title: 'SICHERUNG' },
];

const ManageModal = ({ visible, onClose, onProductsChanged }: Props) => {
  const [tab, setTab] = useState<Tab>('cards');
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [accs, txs] = await Promise.all([AccountService.getAllAccounts(), AccountService.getTransactions()]);
      setAccounts([...accs].sort((a, b) => cardLabel(a.uid, a.name).localeCompare(cardLabel(b.uid, b.name))));
      setTransactions(txs);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Daten konnten nicht geladen werden');
    }
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  // Eine Änderung ausführen und die Anzeige danach neu laden
  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      await load();
    } catch (e: any) {
      setError(e.message || 'Aktion fehlgeschlagen');
    }
  };

  const renameAccount = (account: UserAccount) =>
    run(async () => {
      const name = await askName('Name ändern', account.name);
      if (name) await AccountService.setName(account.uid, name);
    });

  const confirmReset = (account: UserAccount) =>
    Alert.alert(
      'Karte zurücksetzen?',
      `${cardLabel(account.uid, account.name)}: Das Guthaben von ${formatMoney(account.balance)} wird auf 0,00 € gesetzt und der Name entfernt.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Zurücksetzen', style: 'destructive', onPress: () => run(() => AccountService.resetAccount(account.uid)) },
      ],
    );

  const confirmClearHistory = () =>
    Alert.alert(
      'Verlauf löschen?',
      'Alle Buchungen werden gelöscht. Umsatz und Aufladungen stehen danach wieder bei 0,00 €. Die Guthaben auf den Karten bleiben unverändert.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: () => run(() => AccountService.clearTransactions()) },
      ],
    );

  const sales = transactions.filter(tx => tx.type === 'sale').reduce((sum, tx) => sum - tx.amount, 0);
  const topUps = transactions.filter(tx => tx.type === 'topup').reduce((sum, tx) => sum + tx.amount, 0);
  const outstanding = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  const renderAccount = ({ item }: { item: UserAccount }) => (
    <TouchableOpacity style={styles.row} onPress={() => renameAccount(item)}>
      <View style={styles.rowMain}>
        <Text style={styles.rowName}>{cardLabel(item.uid, item.name)}</Text>
        <Text style={styles.rowMuted}>ID …{item.uid.slice(-4)} · {formatDateTime(item.lastSync)}</Text>
        <Text style={styles.rowMuted}>Antippen zum Umbenennen</Text>
      </View>
      <View style={styles.rowAmount}>
        <Text style={styles.amount}>{formatMoney(item.balance)}</Text>
        <TouchableOpacity onPress={() => confirmReset(item)} style={styles.rowAction} hitSlop={8}>
          <Text style={styles.dangerText}>ZURÜCKSETZEN</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowName}>{cardLabel(item.uid, item.name)}</Text>
        <Text style={styles.rowMuted}>{item.description}</Text>
        <Text style={styles.rowMuted}>{formatDateTime(item.timestamp)}</Text>
      </View>
      <View style={styles.rowAmount}>
        <Text style={[styles.amount, item.amount > 0 && { color: SEMERA_THEME.success }]}>
          {item.amount > 0 ? '+' : ''}{formatMoney(item.amount)}
        </Text>
        <Text style={styles.rowMuted}>Stand {formatMoney(item.balanceAfter)}</Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>VERWALTUNG</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>SCHLIESSEN</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Umsatz</Text>
            <Text style={styles.summaryValue}>{formatMoney(sales)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Aufgeladen</Text>
            <Text style={styles.summaryValue}>{formatMoney(topUps)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Auf Karten</Text>
            <Text style={styles.summaryValue}>{formatMoney(outstanding)}</Text>
          </View>
        </View>

        <View style={styles.tabs}>
          {TABS.map(t => {
            const active = t.key === tab;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tab, active && { backgroundColor: SEMERA_THEME.primary }]}
                onPress={() => setTab(t.key)}
              >
                <Text style={[styles.tabText, !active && { color: SEMERA_THEME.textMuted }]}>{t.title}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {(tab === 'cards' || tab === 'history') && (
          <View style={styles.listHeader}>
            <Text style={styles.rowMuted}>
              {tab === 'cards' ? `${accounts.length} Karten` : `${transactions.length} Buchungen`}
            </Text>
            {tab === 'history' && transactions.length > 0 && (
              <TouchableOpacity onPress={confirmClearHistory} hitSlop={8}>
                <Text style={styles.dangerText}>VERLAUF LÖSCHEN</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {tab === 'cards' && (
          <FlatList
            data={accounts}
            renderItem={renderAccount}
            keyExtractor={item => item.uid}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>Noch keine Karten.</Text>}
          />
        )}
        {tab === 'history' && (
          <FlatList
            data={transactions}
            renderItem={renderTransaction}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>Noch keine Buchungen.</Text>}
          />
        )}
        {tab === 'products' && <ProductsPanel onChanged={onProductsChanged} />}
        {tab === 'backup' && (
          <BackupPanel
            onRestored={() => {
              load();
              onProductsChanged();
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SEMERA_THEME.background },
  header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: SEMERA_THEME.text, fontSize: 24, fontWeight: 'bold', letterSpacing: 1 },
  closeButton: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: SEMERA_THEME.card },
  closeText: { color: SEMERA_THEME.text, fontSize: 12, fontWeight: 'bold' },
  summary: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: SEMERA_THEME.card,
    borderRadius: 18,
    padding: 15,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { color: SEMERA_THEME.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  summaryValue: { color: SEMERA_THEME.text, fontSize: 17, fontWeight: '700', marginTop: 4 },
  tabs: {
    flexDirection: 'row',
    margin: 20,
    marginBottom: 10,
    backgroundColor: SEMERA_THEME.card,
    borderRadius: 14,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  error: { color: SEMERA_THEME.danger, marginHorizontal: 20, marginBottom: 10 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 22,
    marginBottom: 8,
    height: 20,
  },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  empty: { color: SEMERA_THEME.textMuted, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: SEMERA_THEME.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  rowMain: { flex: 1, paddingRight: 10 },
  rowName: { color: SEMERA_THEME.text, fontWeight: '600', fontSize: 15 },
  rowMuted: { color: SEMERA_THEME.textMuted, fontSize: 12, marginTop: 2 },
  rowAmount: { alignItems: 'flex-end' },
  rowAction: { marginTop: 10 },
  amount: { color: SEMERA_THEME.text, fontSize: 16, fontWeight: '700' },
  dangerText: { color: SEMERA_THEME.danger, fontSize: 12, fontWeight: '600' },
});

export default ManageModal;
