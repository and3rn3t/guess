import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  useHaptics,
  useLifecycle,
  useReduceMotion,
  useVoiceOver,
} from './useNativeServices'
import type { HapticStyle, VoiceOverPriority } from './NativeServices'

interface Props {
  onResult?: (message: string) => void
}

export function NativeServicesDebugMenu({ onResult }: Props) {
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState<string[]>([])

  const pushLog = useCallback(
    (message: string) => {
      const line = `${new Date().toLocaleTimeString()}: ${message}`
      setLog((prev) => [line, ...prev].slice(0, 12))
      onResult?.(message)
    },
    [onResult],
  )

  if (!__DEV__) {
    return null
  }

  return (
    <>
      <Pressable
        accessibilityLabel="Open native debug menu"
        onPress={() => setOpen((prev) => !prev)}
        style={styles.fab}
      >
        <Text style={styles.fabText}>DEV</Text>
      </Pressable>

      {open ? <Panel onClose={() => setOpen(false)} onResult={pushLog} log={log} /> : null}
    </>
  )
}

function Panel({
  onClose,
  onResult,
  log,
}: {
  onClose: () => void
  onResult: (message: string) => void
  log: string[]
}) {
  const haptics = useHaptics()
  const { announce, isRunning } = useVoiceOver()
  const reduceMotion = useReduceMotion()
  const lifecycle = useLifecycle()

  const runHaptic = useCallback(
    async (style: HapticStyle) => {
      try {
        await haptics.trigger(style)
        onResult(`haptic:${style}`)
      } catch (error) {
        onResult(`haptic:${style} failed ${String(error)}`)
      }
    },
    [haptics, onResult],
  )

  const runAnnouncement = useCallback(
    async (priority: VoiceOverPriority) => {
      try {
        await announce('Native services debug announcement', priority)
        onResult(`voiceOver:${priority}`)
      } catch (error) {
        onResult(`voiceOver:${priority} failed ${String(error)}`)
      }
    },
    [announce, onResult],
  )

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.title}>Native Debug</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.content}>
          <Text style={styles.info}>VoiceOver: {isRunning ? 'running' : 'off'}</Text>
          <Text style={styles.info}>Reduce Motion: {reduceMotion ? 'enabled' : 'disabled'}</Text>
          <Text style={styles.info}>Lifecycle: {lifecycle}</Text>

          <View style={styles.row}>
            {(['light', 'medium', 'heavy'] as HapticStyle[]).map((style) => (
              <Pressable key={style} onPress={() => void runHaptic(style)} style={styles.button}>
                <Text style={styles.buttonText}>{style}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            {(['low', 'default', 'high'] as VoiceOverPriority[]).map((priority) => (
              <Pressable
                key={priority}
                onPress={() => void runAnnouncement(priority)}
                style={styles.button}
              >
                <Text style={styles.buttonText}>VO {priority}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.logTitle}>Recent events</Text>
          {log.map((line) => (
            <Text key={line} style={styles.logLine}>
              {line}
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    zIndex: 50,
    borderRadius: 20,
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fabText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 40,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    padding: 16,
  },
  panel: {
    borderRadius: 14,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    padding: 12,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
  },
  closeText: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    padding: 12,
  },
  info: {
    color: '#cbd5e1',
    marginBottom: 4,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  button: {
    borderRadius: 10,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  buttonText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  logTitle: {
    color: '#93c5fd',
    marginTop: 12,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  logLine: {
    color: '#cbd5e1',
    fontSize: 11,
    marginBottom: 4,
  },
})
