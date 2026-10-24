import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Alert
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { BISTRO_CONFIG, SEMERA_THEME } from './src/constants/config';
import NfcService from './src/services/NfcService';
import AccountService from './src/services/AccountService';
import ProductService, { Product } from './src/services/ProductService';
import { Settings } from 'lucide-react-native';
import ManageModal from './src/components/ManageModal';
import { cardLabel, formatMoney } from './src/utils/format';
import { askName } from './src/utils/prompt';

// Typen definieren für Semera Pay
interface CartItem extends Product {
  cartId: number;
}

type Mode = 'sale' | 'topup';

const MODES: { key: Mode; title: string; hint: string; color: string; scanLabel: string }[] = [
  { key: 'sale', title: 'VERKAUF', hint: 'Bezahlen', color: SEMERA_THEME.primary, scanLabel: 'BEZAHLEN' },
  { key: 'topup', title: 'AUFLADEN', hint: 'Guthaben einzahlen', color: SEMERA_THEME.secondary, scanLabel: 'AUFLADEN' },
];

const App = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [mode, setMode] = useState<Mode>('sale');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chargeAmount, setChargeAmount] = useState(0);
  const [manageVisible, setManageVisible] = useState(false);
  const [products, setProducts] = useState<Product[]>(ProductService.defaults());
  const nextCartId = useRef(0);

  const current = MODES.find(m => m.key === mode)!;
  const total = mode === 'topup' ? chargeAmount : cart.reduce((sum, item) => sum + item.price, 0);

  const haptic = (type: "impactLight" | "notificationSuccess" | "notificationError" = "impactLight") => {
    ReactNativeHapticFeedback.trigger(type);
  };

  const loadProducts = useCallback(() => {
    ProductService.getProducts()
      .then(setProducts)
      .catch(error => console.log(error));
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const depositProduct = products.find(p => p.id === BISTRO_CONFIG.depositProductId);

  const addToCart = (product: Product) => {
    haptic();
    const items = product.withDeposit && depositProduct ? [product, depositProduct] : [product];
    setCart(prev => [
      ...prev,
      ...items.map(item => {
        nextCartId.current += 1;
        return { ...item, cartId: nextCartId.current };
      }),
    ]);
  };

  const removeFromCart = (cartId: number) => {
    haptic();
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  const addChargeAmount = (amount: number) => {
    haptic();
    setChargeAmount(prev => prev + amount);
  };

  const resetOrder = () => {
    setCart([]);
    setChargeAmount(0);
  };

  const selectMode = (next: Mode) => {
    if (next === mode) return;
    haptic("impactLight");
    setMode(next);
    resetOrder();
  };

  // Warenkorb als Text für das Protokoll, z.B. "2× Cola, Popcorn"
  const describeCart = () => {
    const counts = new Map<string, number>();
    cart.forEach(item => counts.set(item.name, (counts.get(item.name) || 0) + 1));
    return Array.from(counts, ([name, count]) => (count > 1 ? `${count}× ${name}` : name)).join(', ');
  };

  // Bei einer Karte ohne Namen nach dem Namen fragen
  const ensureName = async (uid: string) => {
    const account = await AccountService.getAccount(uid);
    if (account?.name) return;
    const name = await askName('Neue Karte');
    if (name) await AccountService.setName(uid, name);
  };

  // Guthaben der Karte anzeigen, mit Möglichkeit den Namen zu vergeben oder zu ändern
  const showBalance = async (uid: string) => {
    const account = await AccountService.getAccount(uid);
    const name = account?.name ?? '';
    Alert.alert(
      cardLabel(uid, name),
      `Guthaben: ${formatMoney(account?.balance ?? 0)}`,
      [
        { text: name ? 'Name ändern' : 'Name vergeben', onPress: () => renameCard(uid, name) },
        { text: 'OK', style: 'cancel' },
      ],
    );
  };

  const renameCard = async (uid: string, currentName: string) => {
    try {
      const name = await askName(currentName ? 'Name ändern' : 'Name vergeben', currentName);
      if (!name) return;
      await AccountService.setName(uid, name);
      await showBalance(uid);
    } catch (error: any) {
      Alert.alert("Fehler", error.message || "Name konnte nicht gespeichert werden");
    }
  };

  const handleNfcAction = async () => {
    setIsProcessing(true);
    haptic();

    try {
      // 1. NFC Karte scannen
      const tag = await NfcService.readTag();
      if (!tag || !tag.id) throw new Error("Keine Karte erkannt");

      const cardUid: string = tag.id;

      // 2. Ohne Summe nur das Guthaben anzeigen
      if (total === 0) {
        haptic("notificationSuccess");
        await showBalance(cardUid);
        return;
      }

      // 3. Neue Karten beim Aufladen benennen
      if (mode === 'topup') await ensureName(cardUid);

      // 4. Buchen: Verkauf zieht ab (und lehnt ab, wenn das Guthaben nicht reicht), Aufladen addiert
      const result = await AccountService.applyTransaction(
        cardUid,
        mode,
        mode === 'sale' ? -total : total,
        mode === 'sale' ? describeCart() : 'Aufladung',
      );

      if (!result.ok) {
        haptic("notificationError");
        Alert.alert("Abgelehnt", `Nicht genügend Guthaben auf der Karte! (Stand: ${formatMoney(result.balance)})`);
        return;
      }

      haptic("notificationSuccess");
      Alert.alert(
        mode === 'sale' ? "Zahlung Erfolg!" : "Aufgeladen!",
        `${cardLabel(cardUid, result.account.name)}\nNeuer Stand: ${formatMoney(result.account.balance)}`
      );
      resetOrder();

    } catch (error: any) {
      console.log(error);
      haptic("notificationError");
      Alert.alert("NFC Fehler", error.message || "Transaktion fehlgeschlagen");
    } finally {
      setIsProcessing(false);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const category = BISTRO_CONFIG.categories.find(c => c.id === item.catId);
    return (
      <TouchableOpacity
        style={[styles.productCard, { borderLeftColor: category?.color || '#fff' }]}
        onPress={() => addToCart(item)}
      >
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productPrice}>
          {(item.price / 100).toFixed(2)} {BISTRO_CONFIG.currency}
          {item.withDeposit && depositProduct ? ` + ${(depositProduct.price / 100).toFixed(2)} Pfand` : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header Bereich */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandTitle}>SEMERA <Text style={{fontWeight: '300'}}>PAY</Text></Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={() => setManageVisible(true)} hitSlop={8}>
          <Settings color={SEMERA_THEME.text} size={20} />
        </TouchableOpacity>
      </View>

      {/* Moduswahl */}
      <View style={styles.modeSwitch}>
        {MODES.map(m => {
          const active = m.key === mode;
          return (
            <TouchableOpacity
              key={m.key}
              style={[styles.modeOption, active && { backgroundColor: m.color }]}
              onPress={() => selectMode(m.key)}
            >
              <Text style={[styles.modeOptionTitle, !active && styles.modeOptionInactive]}>{m.title}</Text>
              <Text style={[styles.modeOptionHint, !active && styles.modeOptionInactive]}>{m.hint}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Anzeige der aktuellen Summe */}
      <View style={styles.displayArea}>
        <Text style={styles.displayLabel}>{mode === 'topup' ? 'Aufladebetrag' : 'Gesamtsumme'}</Text>
        <Text style={[styles.displayValue, mode === 'topup' && { color: current.color }]}>
          {formatMoney(total)}
        </Text>
        {/* Feste Höhe, damit die Karte nicht springt, wenn der Button erscheint */}
        <View style={styles.displayAction}>
          {total !== 0 && (
            <TouchableOpacity onPress={resetOrder} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>ZURÜCKSETZEN</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Aufladebeträge bzw. Produktliste */}
      {mode === 'topup' ? (
        <View style={styles.amountGrid}>
          {BISTRO_CONFIG.topUpAmounts.map(amount => (
            <TouchableOpacity
              key={amount}
              style={[styles.amountButton, { borderColor: SEMERA_THEME.secondary }]}
              onPress={() => addChargeAmount(amount)}
            >
              <Text style={styles.amountButtonText}>+ {(amount / 100).toFixed(0)} {BISTRO_CONFIG.currency}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* Action Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: current.color },
            isProcessing && styles.disabledButton
          ]}
          onPress={handleNfcAction}
          disabled={isProcessing}
        >
          <Text style={styles.actionButtonText}>
            {isProcessing ? 'BITTE WARTEN...' : total === 0 ? 'GUTHABEN PRÜFEN' : current.scanLabel}
          </Text>
        </TouchableOpacity>
      </View>

      <ManageModal visible={manageVisible} onClose={() => setManageVisible(false)} onProductsChanged={loadProducts} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SEMERA_THEME.background },
  header: { paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandTitle: { color: SEMERA_THEME.text, fontSize: 22, fontWeight: 'bold', letterSpacing: 1 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: SEMERA_THEME.card, justifyContent: 'center', alignItems: 'center' },
  modeSwitch: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: SEMERA_THEME.card,
    borderRadius: 18,
    padding: 4,
  },
  modeOption: { flex: 1, paddingVertical: 8, borderRadius: 14, alignItems: 'center' },
  modeOptionTitle: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  modeOptionHint: { color: '#fff', fontSize: 11, marginTop: 1, opacity: 0.85 },
  modeOptionInactive: { color: SEMERA_THEME.textMuted, opacity: 1 },
  displayArea: {
    backgroundColor: SEMERA_THEME.card,
    marginHorizontal: 20,
    marginVertical: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  displayLabel: { color: SEMERA_THEME.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  displayValue: { color: SEMERA_THEME.text, fontSize: 38, fontWeight: '700', marginVertical: 2 },
  displayAction: { height: 26, marginTop: 4, justifyContent: 'center' },
  resetButton: { padding: 5 },
  resetButtonText: { color: SEMERA_THEME.danger, fontSize: 12, fontWeight: '600' },
  listContainer: { padding: 6 },
  amountGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 6, alignContent: 'flex-start' },
  amountButton: {
    width: '46%',
    margin: '2%',
    height: 72,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: SEMERA_THEME.card,
    justifyContent: 'center',
    alignItems: 'center'
  },
  amountButtonText: { color: SEMERA_THEME.text, fontSize: 22, fontWeight: '700' },
  productCard: {
    flex: 1,
    backgroundColor: SEMERA_THEME.card,
    margin: 5,
    padding: 12,
    borderRadius: 14,
    borderLeftWidth: 4,
    height: 76,
    justifyContent: 'center'
  },
  productName: { color: SEMERA_THEME.text, fontWeight: '600', fontSize: 14 },
  productPrice: { color: SEMERA_THEME.textMuted, fontSize: 13, marginTop: 4 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  actionButton: { height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  disabledButton: { opacity: 0.3 }
});

export default App;
