export const SEMERA_THEME = {
  primary: '#007AFF',     // Semera Blue
  secondary: '#FF9500',   // Orange für Admin/Aufladen
  background: '#000000',  // Dark Mode Default
  card: '#1C1C1E',
  text: '#FFFFFF',
  textMuted: '#8E8E93',
  success: '#34C759',
  danger: '#FF3B30',
};

export const BISTRO_CONFIG = {
  name: "Semera Pay",
  currency: "€",
  taxRate: 0, // Falls mal für Vereine relevant
  depositProductId: 'pfand_in', // wird bei Produkten mit withDeposit automatisch mit hinzugefügt
  topUpAmounts: [100, 200, 500, 1000, 2000, 5000], // Aufladebeträge in Cent
  categories: [
    { id: 'cat_drinks', name: 'Getränke', color: '#0A84FF' },
    { id: 'cat_food', name: 'Essen', color: '#FF9F0A' },
    { id: 'cat_deposit', name: 'Pfand', color: '#30D158' },
  ],
  products: [
    { id: 'w_med', catId: 'cat_drinks', name: 'Wasser Med.', price: 100, withDeposit: true },
    { id: 'w_st', catId: 'cat_drinks', name: 'Wasser Stark', price: 100, withDeposit: true },
    { id: 'cola', catId: 'cat_drinks', name: 'Cola', price: 150, withDeposit: true },
    { id: 'cola_mix', catId: 'cat_drinks', name: 'Cola-Mix', price: 150, withDeposit: true },
    { id: 'fanta', catId: 'cat_drinks', name: 'Fanta', price: 150, withDeposit: true },
    { id: 'sprite', catId: 'cat_drinks', name: 'Sprite', price: 150, withDeposit: true },
    { id: 'apfel', catId: 'cat_drinks', name: 'Apfelschorle', price: 150, withDeposit: true },
    { id: 'slush', catId: 'cat_drinks', name: 'Slush Ice', price: 150 },
    { id: 'yumyum', catId: 'cat_food', name: 'Yum Yum', price: 150 },
    { id: 'popcorn', catId: 'cat_food', name: 'Popcorn', price: 50 },
    { id: 'crepe_zz', catId: 'cat_food', name: 'Crêpe Z/Z', price: 200 },
    { id: 'crepe_nut', catId: 'cat_food', name: 'Crêpe Nutella', price: 250 },
    { id: 'crepe_herz', catId: 'cat_food', name: 'Crêpe Herzhaft', price: 300 },
    { id: 'pfand_in', catId: 'cat_deposit', name: 'Pfand +', price: 50 },
    { id: 'pfand_out', catId: 'cat_deposit', name: 'Pfand -', price: -50 },
  ]
};

export const SECURITY_CONFIG = {
  salt: "SEMERAPAY_2026_SECRET", // Wird für die Prüfsumme auf der Karte genutzt
  adminPin: "1234"               // Um in den Admin-Bereich zu kommen
};