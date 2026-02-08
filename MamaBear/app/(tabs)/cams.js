import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const BABY_WS_URL = 'wss://thehun-christine-relocation-additional.trycloudflare.com/';
const ROOMCAM_SERVER_IP = '10.244.95.28';
const ROOM_WS_URL = `wss://leader-produced-def-strand.trycloudflare.com`;

export default function CamsScreen() {
	const colorScheme = useColorScheme();
	const babyWs = useRef(null);
	const roomWs = useRef(null);
	const [babyVideo, setBabyVideo] = useState(null);
	const [babyConnection, setBabyConnection] = useState('DISCONNECTED');
	const [babyStatus, setBabyStatus] = useState('CONNECTING...');
	const [roomVideo, setRoomVideo] = useState(null);
	const [roomConnection, setRoomConnection] = useState('DISCONNECTED');
	const [roomStatus, setRoomStatus] = useState('CONNECTING...');
	const [faceCount, setFaceCount] = useState(0);

	useEffect(() => {
		const connectBaby = () => {
			if (babyWs.current && (babyWs.current.readyState === WebSocket.OPEN || babyWs.current.readyState === WebSocket.CONNECTING)) return;
			setBabyConnection('CONNECTING');
			setBabyStatus('CONNECTING...');
			babyWs.current = new WebSocket(BABY_WS_URL);

			babyWs.current.onopen = () => setBabyConnection('CONNECTED');
			babyWs.current.onmessage = (e) => {
				try {
					const parsed = JSON.parse(e.data);
					if (parsed.video) setBabyVideo(parsed.video);
					if (parsed.status) setBabyStatus(parsed.status);
				} catch (_err) {
					// Ignore parse errors
				}
			};
			babyWs.current.onclose = () => {
				setBabyConnection('DISCONNECTED');
				setTimeout(connectBaby, 2000);
			};
			babyWs.current.onerror = () => setBabyConnection('ERROR');
		};

		connectBaby();

		return () => {
			if (babyWs.current) babyWs.current.close();
		};
	}, []);

	useEffect(() => {
		const connectRoom = () => {
			if (roomWs.current && (roomWs.current.readyState === WebSocket.OPEN || roomWs.current.readyState === WebSocket.CONNECTING)) return;
			setRoomConnection('CONNECTING');
			setRoomStatus('CONNECTING...');
			roomWs.current = new WebSocket(ROOM_WS_URL);

			roomWs.current.onopen = () => setRoomConnection('CONNECTED');
			roomWs.current.onmessage = (e) => {
				try {
					const parsed = JSON.parse(e.data);
					if (parsed.video) setRoomVideo(parsed.video);
					if (parsed.status) setRoomStatus(parsed.status);
					if (typeof parsed.faces_detected === 'number') setFaceCount(parsed.faces_detected);
				} catch (_err) {
					// Ignore parse errors
				}
			};
			roomWs.current.onclose = () => {
				setRoomConnection('DISCONNECTED');
				setTimeout(connectRoom, 2000);
			};
			roomWs.current.onerror = () => setRoomConnection('ERROR');
		};

		connectRoom();

		return () => {
			if (roomWs.current) roomWs.current.close();
		};
	}, []);

	const getStatusColor = (status) => {
		if (!status) return '#888';
		if (status.includes('ALERT') || status === 'ERROR') return Colors[colorScheme ?? 'light'].accent;
		if (status.includes('SAFE') || status === 'CONNECTED') return Colors[colorScheme ?? 'light'].success;
		return Colors[colorScheme ?? 'light'].tint;
	};

	return (
		<ScrollView style={{ flex: 1 }}>
			<ThemedView style={styles.container}>
				<ThemedView style={styles.header}>
					<ThemedText type="title" style={styles.title}>📹 Cameras</ThemedText>
					<ThemedText style={styles.subtitle}>Live feeds from baby and room</ThemedText>
				</ThemedView>

				<ThemedView style={styles.card}>
					<View style={styles.cardHeader}>
						<ThemedText type="subtitle" style={styles.cardTitle}>Baby Cam</ThemedText>
						<View style={[styles.badge, { backgroundColor: getStatusColor(babyConnection) }]}>
							<ThemedText style={styles.badgeText}>{babyConnection}</ThemedText>
						</View>
					</View>
					<View style={styles.videoContainer}>
						{babyVideo ? (
							<Image
								source={{ uri: `data:image/jpeg;base64,${babyVideo}` }}
								style={styles.video}
								resizeMode="contain"
							/>
						) : (
							<ThemedText style={styles.placeholderText}>{babyStatus}</ThemedText>
						)}
					</View>
				</ThemedView>

				<ThemedView style={styles.card}>
					<View style={styles.cardHeader}>
						<ThemedText type="subtitle" style={styles.cardTitle}>Room Cam</ThemedText>
						<View style={[styles.badge, { backgroundColor: getStatusColor(roomConnection) }]}>
							<ThemedText style={styles.badgeText}>{roomConnection}</ThemedText>
						</View>
					</View>
					<ThemedText style={styles.metaText}>Faces detected: {faceCount}</ThemedText>
					<View style={styles.videoContainer}>
						{roomVideo ? (
							<Image
								source={{ uri: `data:image/jpeg;base64,${roomVideo}` }}
								style={styles.video}
								resizeMode="contain"
							/>
						) : (
							<ThemedText style={styles.placeholderText}>{roomStatus}</ThemedText>
						)}
					</View>
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
		padding: 20,
		borderRadius: 20,
		marginBottom: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.05,
		shadowRadius: 8,
		elevation: 2,
	},
	cardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 8,
	},
	cardTitle: {
		fontSize: 20,
		fontWeight: '700',
	},
	badge: {
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 10,
	},
	badgeText: {
		fontSize: 11,
		color: '#fff',
		fontWeight: '700',
	},
	metaText: {
		fontSize: 13,
		opacity: 0.6,
		marginBottom: 10,
	},
	videoContainer: {
		height: 220,
		borderRadius: 16,
		overflow: 'hidden',
		backgroundColor: '#000',
		alignItems: 'center',
		justifyContent: 'center',
	},
	video: {
		width: '100%',
		height: '100%',
	},
	placeholderText: {
		color: '#ccc',
		fontSize: 13,
		textAlign: 'center',
		fontWeight: '600',
	},
});
