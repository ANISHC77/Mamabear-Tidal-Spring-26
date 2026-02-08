import { StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function SettingsScreen() {
	
	const settingsGroups = [
		{
			title: 'Monitoring',
			items: [
				{ label: 'Alert Sensitivity', value: 'Medium', icon: '🔔' },
				{ label: 'Recording Duration', value: '30s', icon: '⏱️' },
				{ label: 'Audio Alerts', value: 'On', icon: '🔊' },
			]
		},
		{
			title: 'Camera',
			items: [
				{ label: 'Video Quality', value: 'HD', icon: '📹' },
				{ label: 'Night Vision', value: 'Auto', icon: '🌙' },
				{ label: 'Frame Rate', value: '30 FPS', icon: '🎬' },
			]
		},
		{
			title: 'Notifications',
			items: [
				{ label: 'Push Notifications', value: 'On', icon: '📱' },
				{ label: 'Email Alerts', value: 'Off', icon: '✉️' },
				{ label: 'Sound', value: 'On', icon: '🔔' },
			]
		},
		{
			title: 'About',
			items: [
				{ label: 'App Version', value: '1.0.0', icon: 'ℹ️' },
				{ label: 'Privacy Policy', value: '', icon: '🔒' },
				{ label: 'Support', value: '', icon: '💬' },
			]
		}
	];
	
	return (
		<ScrollView style={{ flex: 1 }}>
			<ThemedView style={styles.container}>
				<ThemedView style={styles.header}>
					<ThemedText type="title" style={styles.title}>⚙️ Settings</ThemedText>
					<ThemedText style={styles.subtitle}>Customize your experience</ThemedText>
				</ThemedView>
				
				{settingsGroups.map((group, groupIdx) => (
					<ThemedView key={groupIdx} style={styles.group}>
						<ThemedText style={styles.groupTitle}>{group.title}</ThemedText>
						<ThemedView style={styles.groupCard}>
							{group.items.map((item, itemIdx) => (
								<TouchableOpacity
									key={itemIdx}
									style={[
										styles.settingItem,
										itemIdx !== group.items.length - 1 && styles.settingItemBorder
									]}
								>
									<ThemedView style={styles.settingLeft}>
										<ThemedText style={styles.settingIcon}>{item.icon}</ThemedText>
										<ThemedText style={styles.settingLabel}>{item.label}</ThemedText>
									</ThemedView>
									{item.value ? (
										<ThemedText style={styles.settingValue}>{item.value}</ThemedText>
									) : (
										<ThemedText style={styles.chevron}>›</ThemedText>
									)}
								</TouchableOpacity>
							))}
						</ThemedView>
					</ThemedView>
				))}
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
	group: {
		marginBottom: 24,
	},
	groupTitle: {
		fontSize: 13,
		fontWeight: '600',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		opacity: 0.5,
		marginBottom: 8,
		marginLeft: 8,
	},
	groupCard: {
		borderRadius: 16,
		overflow: 'hidden',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.05,
		shadowRadius: 8,
		elevation: 2,
	},
	settingItem: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 14,
		paddingHorizontal: 16,
	},
	settingItemBorder: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: 'rgba(60, 60, 67, 0.12)',
	},
	settingLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	settingIcon: {
		fontSize: 20,
	},
	settingLabel: {
		fontSize: 16,
		fontWeight: '500',
	},
	settingValue: {
		fontSize: 16,
		opacity: 0.5,
		fontWeight: '500',
	},
	chevron: {
		fontSize: 24,
		opacity: 0.3,
		fontWeight: '400',
	},
});
