import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

class NfcService {
  constructor() {
    NfcManager.start();
  }

  // Hilfsfunktion zum Berechnen der Prüfsumme
  generateChecksum(id, balance) {
    // Einfaches Beispiel: Ein String aus ID und Balance + Salt
    // In einer Pro-Version würde man hier einen echten Hash (SHA256) nutzen
    const raw = `${id}:${balance}:SEMERASALT`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  async readTag() {
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: 'Karte an das iPhone halten',
      });
      const tag = await NfcManager.getTag();
      // Meldung, die iOS beim Schließen des Scan-Dialogs kurz anzeigt
      NfcManager.setAlertMessageIOS('Karte erkannt').catch(() => {});
      return tag;
    } catch (ex) {
      console.warn('Fehler beim Lesen', ex);
      return null;
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
  }
}

export default new NfcService();