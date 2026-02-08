import { StyleSheet, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function CamsScreen() {
	
	return (
		<ScrollView style={{ flex: 1 }}>
			<ThemedView style={styles.container}>
				<ThemedView style={styles.header}>
					<ThemedText type="title" style={styles.title}>📹 Cameras</ThemedText>
					<ThemedText style={styles.subtitle}>Manage multiple camera feeds</ThemedText>
				</ThemedView>
				
				<ThemedView style={styles.card}>
					<ThemedText type="subtitle" style={styles.cardTitle}>Coming Soon</ThemedText>
					<ThemedText style={styles.cardDescription}>
						Multi-camera support will allow you to monitor multiple rooms and angles simultaneously.
					</ThemedText>
				</ThemedView>
			</ThemedView>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 16,
	},
	header: {
		paddingVertical: 24,
		paddingHorizontal: 8,
	},
	title: {
		fontSize: 32,
		fontWeight: '800',
		letterSpacing: 0.5,
		marginBottom: 8,
	},
	subtitle: {
		fontSize: 15,
		opacity: 0.6,
		fontWeight: '500',
	},
	card: {
		padding: 24,
		borderRadius: 20,
		marginBottom: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.05,
		shadowRadius: 8,
		elevation: 2,
	},
	cardTitle: {
		fontSize: 20,
		fontWeight: '700',
		marginBottom: 12,
	},
	cardDescription: {
		fontSize: 15,
		lineHeight: 22,
		opacity: 0.7,
	},
});
