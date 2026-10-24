import { Alert } from 'react-native';

// Namen per Eingabedialog abfragen; null, wenn übersprungen oder leer
export const askName = (title: string, current = ''): Promise<string | null> =>
  new Promise(resolve => {
    Alert.prompt(
      title,
      'Name des Karteninhabers',
      [
        { text: 'Überspringen', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Speichern', onPress: (text?: string) => resolve(text?.trim() || null) },
      ],
      'plain-text',
      current,
    );
  });
