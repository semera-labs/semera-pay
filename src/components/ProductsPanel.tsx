import React, { useEffect, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { BISTRO_CONFIG, SEMERA_THEME } from '../constants/config';
import ProductService, { Product } from '../services/ProductService';
import { formatMoney } from '../utils/format';

interface Props {
  // Wird aufgerufen, nachdem die Produkte geändert wurden
  onChanged: () => void;
}

const DEPOSIT_CATEGORY = 'cat_deposit';

// "1,50" oder "1.5" in Cent umrechnen; null, wenn keine gültige Zahl
const parsePrice = (text: string): number | null => {
  const value = parseFloat(text.trim().replace(',', '.'));
  return Number.isFinite(value) ? Math.round(value * 100) : null;
};

const priceToText = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

const categoryOf = (catId: string) => BISTRO_CONFIG.categories.find(c => c.id === catId);

const ProductsPanel = ({ onChanged }: Props) => {
  const [products, setProducts] = useState<Product[]>([]);
  // null: Liste anzeigen; sonst wird gerade ein Produkt bearbeitet (isNew: neu angelegt)
  const [editing, setEditing] = useState<{ id: string; isNew: boolean } | null>(null);
  const [name, setName] = useState('');
  const [priceText, setPriceText] = useState('');
  const [catId, setCatId] = useState(BISTRO_CONFIG.categories[0].id);
  const [withDeposit, setWithDeposit] = useState(false);

  useEffect(() => {
    ProductService.getProducts()
      .then(setProducts)
      .catch((e: any) => Alert.alert('Fehler', e.message || 'Produkte konnten nicht geladen werden'));
  }, []);

  const persist = async (next: Product[]) => {
    try {
      await ProductService.saveProducts(next);
      setProducts(next);
      onChanged();
      return true;
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Produkte konnten nicht gespeichert werden');
      return false;
    }
  };

  const startEdit = (product?: Product) => {
    if (product) {
      setEditing({ id: product.id, isNew: false });
      setName(product.name);
      setPriceText(priceToText(product.price));
      setCatId(product.catId);
      setWithDeposit(!!product.withDeposit);
    } else {
      setEditing({ id: `p_${Date.now().toString(36)}`, isNew: true });
      setName('');
      setPriceText('');
      setCatId(BISTRO_CONFIG.categories[0].id);
      setWithDeposit(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    const price = parsePrice(priceText);
    if (!name.trim()) {
      Alert.alert('Name fehlt', 'Bitte einen Namen eingeben.');
      return;
    }
    if (price === null) {
      Alert.alert('Preis ungültig', 'Bitte einen Preis eingeben, z.B. 1,50.');
      return;
    }
    const product: Product = {
      id: editing.id,
      catId,
      name: name.trim(),
      price,
      ...(withDeposit && catId !== DEPOSIT_CATEGORY ? { withDeposit: true } : {}),
    };
    const next = editing.isNew ? [...products, product] : products.map(p => (p.id === product.id ? product : p));
    if (await persist(next)) setEditing(null);
  };

  const confirmDelete = () => {
    if (!editing) return;
    if (editing.id === BISTRO_CONFIG.depositProductId) {
      Alert.alert('Nicht möglich', 'Dieses Produkt wird für das automatische Pfand gebraucht und kann nicht gelöscht werden.');
      return;
    }
    Alert.alert('Produkt löschen?', `„${name}“ wird aus der Produktliste entfernt. Bisherige Buchungen bleiben unverändert.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          if (await persist(products.filter(p => p.id !== editing.id))) setEditing(null);
        },
      },
    ]);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= products.length) return;
    const next = [...products];
    [next[index], next[target]] = [next[target], next[index]];
    persist(next);
  };

  const confirmReset = () =>
    Alert.alert('Standard wiederherstellen?', 'Alle Änderungen an den Produkten gehen verloren. Karten und Buchungen bleiben unverändert.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Wiederherstellen',
        style: 'destructive',
        onPress: async () => {
          try {
            await ProductService.resetToDefaults();
            setProducts(ProductService.defaults());
            onChanged();
          } catch (e: any) {
            Alert.alert('Fehler', e.message || 'Aktion fehlgeschlagen');
          }
        },
      },
    ]);

  if (editing) {
    return (
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="z.B. Cola"
          placeholderTextColor={SEMERA_THEME.textMuted}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Preis in €</Text>
        <TextInput
          style={styles.input}
          value={priceText}
          onChangeText={setPriceText}
          placeholder="z.B. 1,50"
          placeholderTextColor={SEMERA_THEME.textMuted}
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.label}>Kategorie</Text>
        <View style={styles.chips}>
          {BISTRO_CONFIG.categories.map(cat => {
            const active = cat.id === catId;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, active && { backgroundColor: cat.color }]}
                onPress={() => setCatId(cat.id)}
              >
                <Text style={[styles.chipText, !active && { color: SEMERA_THEME.textMuted }]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {catId !== DEPOSIT_CATEGORY && (
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.rowName}>Pfand automatisch dazu</Text>
              <Text style={styles.rowMuted}>Beim Antippen kommt „Pfand +“ mit in den Warenkorb.</Text>
            </View>
            <Switch value={withDeposit} onValueChange={setWithDeposit} />
          </View>
        )}

        <TouchableOpacity style={styles.primaryButton} onPress={save}>
          <Text style={styles.buttonText}>SPEICHERN</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setEditing(null)}>
          <Text style={styles.buttonText}>ABBRECHEN</Text>
        </TouchableOpacity>
        {!editing.isNew && (
          <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete}>
            <Text style={styles.dangerText}>PRODUKT LÖSCHEN</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  const renderProduct = ({ item, index }: { item: Product; index: number }) => {
    const category = categoryOf(item.catId);
    return (
      <TouchableOpacity style={[styles.row, { borderLeftColor: category?.color || '#fff' }]} onPress={() => startEdit(item)}>
        <View style={styles.rowMain}>
          <Text style={styles.rowName}>{item.name}</Text>
          <Text style={styles.rowMuted}>
            {category?.name}{item.withDeposit ? ' · mit Pfand' : ''}
          </Text>
        </View>
        <Text style={styles.price}>{formatMoney(item.price)}</Text>
        <View style={styles.arrows}>
          <TouchableOpacity onPress={() => move(index, -1)} hitSlop={8} disabled={index === 0}>
            <ChevronUp color={SEMERA_THEME.text} size={20} style={index === 0 && styles.arrowDisabled} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => move(index, 1)} hitSlop={8} disabled={index === products.length - 1}>
            <ChevronDown color={SEMERA_THEME.text} size={20} style={index === products.length - 1 && styles.arrowDisabled} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={products}
      renderItem={renderProduct}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <TouchableOpacity style={styles.primaryButton} onPress={() => startEdit()}>
          <Text style={styles.buttonText}>+ PRODUKT HINZUFÜGEN</Text>
        </TouchableOpacity>
      }
      ListFooterComponent={
        <TouchableOpacity style={styles.deleteButton} onPress={confirmReset}>
          <Text style={styles.dangerText}>STANDARD-PRODUKTE WIEDERHERSTELLEN</Text>
        </TouchableOpacity>
      }
    />
  );
};

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  label: { color: SEMERA_THEME.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: SEMERA_THEME.card,
    color: SEMERA_THEME.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, backgroundColor: SEMERA_THEME.card, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  chipText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SEMERA_THEME.card,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  switchText: { flex: 1, paddingRight: 10 },
  primaryButton: { backgroundColor: SEMERA_THEME.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20, marginBottom: 4 },
  secondaryButton: { backgroundColor: SEMERA_THEME.card, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  deleteButton: { alignItems: 'center', paddingVertical: 18 },
  dangerText: { color: SEMERA_THEME.danger, fontSize: 12, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SEMERA_THEME.card,
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 14,
    marginTop: 8,
  },
  rowMain: { flex: 1, paddingRight: 10 },
  rowName: { color: SEMERA_THEME.text, fontWeight: '600', fontSize: 15 },
  rowMuted: { color: SEMERA_THEME.textMuted, fontSize: 12, marginTop: 2 },
  price: { color: SEMERA_THEME.text, fontSize: 16, fontWeight: '700', marginRight: 12 },
  arrows: { gap: 8 },
  arrowDisabled: { opacity: 0.25 },
});

export default ProductsPanel;
