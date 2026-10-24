<p align="center">
  <img src="./docs/icon.png" alt="Semera Pay icon" width="80"/>
</p>

<h1 align="center">Semera Pay</h1>

<p align="center"><em>Cashless payment for the bistro at seminars: an NFC card per guest, loaded with credit, paid with the iPhone. Works completely offline.</em></p>

[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](./package.json)
[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-orange.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-iOS%2015.1%2B-lightgrey.svg?logo=apple)](./ios)
[![React Native](https://img.shields.io/badge/React%20Native-0.84-61dafb.svg?logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg?logo=typescript&logoColor=white)](./tsconfig.json)
[![Offline](https://img.shields.io/badge/network-none-brightgreen.svg)](#-notes)

**Semera Pay** is an iOS app for the bistro at a seminar or camp. Nobody has to count out a few euros and hand back change for every drink: a guest hands over money once, it is loaded as credit onto an NFC card, and every purchase is paid by holding the card to the iPhone. What is left at the end is paid back, and when the credit runs out the card is loaded again, much like the NFC cards in a canteen.
Nothing else: no accounts, no server, no network access.

## ✨ Features

* **Sale mode**

  * A product grid in categories (drinks, food, deposit), a cart and the total.
  * Products with a deposit (*Pfand*) add the deposit automatically. The *Pfand −* product books a returned deposit as a negative amount.
  * Pay by holding the card to the iPhone. A payment is refused when the credit is not enough: the balance never falls below 0.

* **Top-up mode**

  * Preset amounts (1, 2, 5, 10, 20 and 50 €) that add up, then hold the card to the iPhone.
  * A card the app has not seen before is created on its first top-up, and its owner's name is asked for.

* **Cards**

  * A card is identified by its NFC tag ID. Each card has an optional name (rename by tapping) and a balance.
  * Resetting a card sets the balance to 0 and removes the name, and is noted in the history.

* **Management** (*Verwaltung*)

  * Totals for sales, topped-up credit and credit on cards.
  * Tabs for **cards**, **history** (every booking, newest first), **products** and **backup**.
  * **Products** can be added, edited and deleted (name, price, category, deposit). The defaults from the configuration can be restored.

* **Backup**

  * Create a backup file (cards, history and products) and share it with the iOS share sheet.
  * Export **cards** or **history** as CSV for Excel or Numbers (semicolon-separated, amounts with a decimal comma).
  * Restore from a backup. The current state is saved first, so a restore can be undone.

* **Small and calm**

  * Dark interface with haptic feedback, in German.
  * Works without a network: the app contains no network code.

## 📦 Project Structure

```
semera-pay/
├── App.tsx                       # Sale and top-up screen, NFC action, cart
├── src/
│   ├── components/
│   │   ├── ManageModal.tsx       # Management: cards, history, products, backup
│   │   ├── ProductsPanel.tsx     # Edit the product list
│   │   └── BackupPanel.tsx       # Backup, CSV export, restore
│   ├── services/
│   │   ├── NfcService.js         # Reads the NFC tag (react-native-nfc-manager)
│   │   ├── AccountService.ts     # Cards, balances, bookings (stored on the device)
│   │   ├── ProductService.ts     # Product list (stored on the device)
│   │   └── BackupService.ts      # Backup files, CSV export, restore
│   ├── constants/config.js       # Theme, currency, top-up amounts, categories, default products
│   └── utils/                    # Money formatting, name prompt
├── ios/                          # Xcode project (SemeraPay.xcworkspace), NFC entitlement
├── patches/                      # patch-package patch for react-native-nfc-manager
├── __tests__/                    # Jest
└── README.md
```

## 🧠 How it works

| Piece | Where |
| --- | --- |
| Hold-to-scan with Core NFC: reads the **tag ID** of the card. The patch for `react-native-nfc-manager` skips the NDEF read so the scan sheet closes immediately. | `src/services/NfcService.js`, `patches/` |
| Cards and bookings (`sale`, `topup`, `reset`) are saved in the app's local storage, keyed by the card's tag ID. Writes are queued so two bookings cannot overwrite each other, and a booking never takes the balance below 0. | `src/services/AccountService.ts` |
| Products, categories, top-up amounts and the currency come from the configuration; edits to the product list are saved on the device. | `src/constants/config.js`, `src/services/ProductService.ts` |
| Backups are JSON files in the app's documents folder (`semera-pay-backup-…`); a safety copy (`semera-pay-vorher-…`) is made before every restore. | `src/services/BackupService.ts` |

## ⚙️ Development

Node 22.11 or newer, Xcode and CocoaPods. NFC needs a real iPhone, the simulator cannot scan cards.

```bash
npm install                 # also applies the patch in patches/
bundle install              # first time only: installs CocoaPods
cd ios && bundle exec pod install && cd ..
npm start                   # Metro
npm run ios                 # build and run (choose your iPhone in Xcode for NFC)
```

```bash
npm test                    # Jest
npm run lint                # ESLint
```

## 🛠️ Build

Open `ios/SemeraPay.xcworkspace` in Xcode, select a signing team, and archive for the App Store.

## 🔒 Notes

* **Requirements:** an iPhone with NFC, iOS 15.1 or newer, and NFC cards that the iPhone can read. The app asks for NFC access (*NFCReaderUsageDescription*).
* **Where the data lives:** cards, balances, history and products are stored on the iPhone that runs the app, in its local storage, and not on the cards. Keep the backups: a lost phone or a deleted app loses the balances.
* **Offline:** the app makes no network requests and has no accounts.
* **Platform:** the project is built for iOS. The `android/` folder comes from the React Native template.
* **Configuration:** the bistro's products, prices, categories and top-up amounts are in `src/constants/config.js`.

## 👤 Author

* **Jan Schulz-Nigmann / Semera**
* Copyright © 2026 Jan Schulz-Nigmann / Semera
* License: [PolyForm Noncommercial 1.0.0](./LICENSE) plus an explicit permission for non-profit organizations. Free for noncommercial use and for non-profits of any kind (associations, clubs, churches, charities, schools). **Commercial use needs a separate license** from Semera.
