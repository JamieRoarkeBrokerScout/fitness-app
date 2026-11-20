import { Alert, Platform } from 'react-native';

export interface Choice {
  label: string,
  style?: 'cancel' | 'destructive',
  onSelect?: () => void,
}

// Native alert with several outcomes. react-native-web's Alert does nothing, so on web each
// real choice is offered in turn with the browser's confirm dialog.
export function choose(title: string, message: string, choices: Choice[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, choices.map(({ label, style, onSelect }) => ({ text: label, style, onPress: onSelect })));
    return;
  }
  for (const choice of choices) {
    if (choice.style !== 'cancel' && window.confirm(`${title}\n\n${message}\n\n${choice.label}?`)) {
      // confirm blocks, so run the choice after the caller has finished, as it would natively
      setTimeout(() => choice.onSelect?.(), 0);
      return;
    }
  }
}
