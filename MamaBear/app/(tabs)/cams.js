import { StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function CamsScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Cams</ThemedText>
      <ThemedText>This is the Cams tab.</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});