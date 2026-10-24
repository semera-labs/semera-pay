import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SEMERA_THEME } from '../constants/config';
import BackupService, { BackupFile } from '../services/BackupService';
import { formatDateTimeFull } from '../utils/format';

interface Props {
  // Wird aufgerufen, nachdem eine Sicherung wiederhergestellt wurde
  onRestored: () => void;
}

const BackupPanel = ({ onRestored }: Props) => {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [files, last] = await Promise.all([BackupService.listBackups(), BackupService.getLastBackup()]);
    setBackups(files);
    setLastBackup(last);
  }, []);

  // Eine Aktion ausführen, dabei Doppeltippen verhindern und Fehler anzeigen
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Aktion fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    run(refresh);
    // nur beim Öffnen des Reiters laden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shareFile = async (path: string) => {
    await Share.share({ url: `file://${path}` });
  };

  const createBackup = () =>
    run(async () => {
      const path = await BackupService.createBackup();
      await refresh();
      await shareFile(path);
    });

  const exportCsv = (kind: 'cards' | 'history') =>
    run(async () => {
      await shareFile(await BackupService.exportCsv(kind));
    });

  const confirmRestore = (file: BackupFile) =>
    Alert.alert(
      'Sicherung wiederherstellen?',
      `${file.name}\n\nAlle aktuellen Karten, Guthaben und Buchungen werden durch diese Sicherung ersetzt. Der aktuelle Stand wird vorher automatisch gesichert.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Wiederherstellen',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              await BackupService.restoreBackup(file.path);
              await refresh();
              onRestored();
              Alert.alert('Wiederhergestellt', 'Die Sicherung wurde eingespielt.');
            }),
        },
      ],
    );

  const renderBackup = ({ item }: { item: BackupFile }) => (
    <TouchableOpacity style={styles.row} onPress={() => confirmRestore(item)} disabled={busy}>
      <View style={styles.rowMain}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.rowMuted}>{formatDateTimeFull(item.modified)} · {Math.max(1, Math.round(item.size / 1024))} KB</Text>
        <Text style={styles.rowMuted}>Antippen zum Wiederherstellen</Text>
      </View>
      <TouchableOpacity onPress={() => run(() => shareFile(item.path))} hitSlop={8} disabled={busy}>
        <Text style={styles.linkText}>TEILEN</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const header = (
    <View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>BACKUP</Text>
        <Text style={styles.rowMuted}>
          Letztes Backup: {lastBackup ? formatDateTimeFull(lastBackup) : 'noch nie'}
        </Text>
        <TouchableOpacity style={[styles.button, busy && styles.disabled]} onPress={createBackup} disabled={busy}>
          <Text style={styles.buttonText}>BACKUP ERSTELLEN & TEILEN</Text>
        </TouchableOpacity>
        <Text style={styles.rowMuted}>
          Die Datei liegt zusätzlich in der Dateien-App unter „Auf meinem iPhone“ → „Semera Pay“. Teile oder kopiere sie
          dort weg, sonst geht sie mit der App verloren.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>EXPORT FÜR EXCEL</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.button, styles.buttonHalf, busy && styles.disabled]} onPress={() => exportCsv('cards')} disabled={busy}>
            <Text style={styles.buttonText}>KARTEN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.buttonHalf, busy && styles.disabled]} onPress={() => exportCsv('history')} disabled={busy}>
            <Text style={styles.buttonText}>VERLAUF</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.listTitle}>WIEDERHERSTELLEN</Text>
    </View>
  );

  return (
    <FlatList
      data={backups}
      renderItem={renderBackup}
      keyExtractor={item => item.path}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <Text style={styles.empty}>
          Keine Sicherungen im App-Ordner. Eine Sicherung von einem anderen Gerät legst du in der Dateien-App in den
          Ordner „Semera Pay“, dann erscheint sie hier.
        </Text>
      }
    />
  );
};

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  card: { backgroundColor: SEMERA_THEME.card, borderRadius: 14, padding: 14, marginBottom: 12 },
  sectionTitle: { color: SEMERA_THEME.text, fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  button: { backgroundColor: SEMERA_THEME.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginVertical: 10 },
  buttonHalf: { flex: 1 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  disabled: { opacity: 0.4 },
  listTitle: { color: SEMERA_THEME.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 8, marginLeft: 2 },
  empty: { color: SEMERA_THEME.textMuted, textAlign: 'center', marginTop: 10, paddingHorizontal: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SEMERA_THEME.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  rowMain: { flex: 1, paddingRight: 10 },
  rowName: { color: SEMERA_THEME.text, fontWeight: '600', fontSize: 14 },
  rowMuted: { color: SEMERA_THEME.textMuted, fontSize: 12, marginTop: 2 },
  linkText: { color: SEMERA_THEME.primary, fontSize: 12, fontWeight: '700' },
});

export default BackupPanel;
