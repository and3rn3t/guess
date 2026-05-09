let bootstrapError = null

try {
	require('./src/debug/installGlobalErrorHandler')
	require('expo-router/entry')
} catch (error) {
	bootstrapError = error
	try {
		// Keep at least one reliable error line for Metro/device logs.
		console.error('[BootstrapError]', error)
	} catch {
		// Ignore logging failures in bootstrap path.
	}

	const React = require('react')
	const { registerRootComponent } = require('expo')
	const { View, Text } = require('react-native')

	const BootFallback = () => {
		const message =
			bootstrapError instanceof Error
				? bootstrapError.message
				: String(bootstrapError)

		return React.createElement(
			View,
			{
				style: {
					flex: 1,
					padding: 24,
					justifyContent: 'center',
					backgroundColor: '#111827',
				},
			},
			React.createElement(
				Text,
				{
					style: {
						color: '#F9FAFB',
						fontSize: 18,
						fontWeight: '700',
						marginBottom: 10,
					},
				},
				'Startup bootstrap failed',
			),
			React.createElement(
				Text,
				{
					style: {
						color: '#FCA5A5',
						fontSize: 14,
					},
				},
				message,
			),
		)
	}

	registerRootComponent(BootFallback)
}
