import { supabase } from './supabase'

/**
 * Wraps a single Supabase Realtime channel for one room. Drawing strokes,
 * canvas-sync, and chat all ride on Broadcast (ephemeral, never persisted);
 * "who's online" rides on Presence (also ephemeral). Nothing here touches
 * Postgres, so none of it can become permanent history.
 */
export function createRoomChannel(roomCode, { sessionId, displayName }) {
  const channel = supabase.channel(`room:${roomCode}`, {
    config: {
      broadcast: { ack: false, self: false },
      presence: { key: sessionId }
    }
  })

  return {
    channel,

    subscribe(handlers = {}) {
      if (handlers.onStroke) channel.on('broadcast', { event: 'draw:stroke' }, ({ payload }) => handlers.onStroke(payload))
      if (handlers.onClear) channel.on('broadcast', { event: 'draw:clear' }, ({ payload }) => handlers.onClear(payload))
      if (handlers.onUndoRedo) channel.on('broadcast', { event: 'draw:undoredo' }, ({ payload }) => handlers.onUndoRedo(payload))
      if (handlers.onChat) channel.on('broadcast', { event: 'chat:message' }, ({ payload }) => handlers.onChat(payload))
      if (handlers.onSyncRequest) channel.on('broadcast', { event: 'sync:request' }, ({ payload }) => handlers.onSyncRequest(payload))
      if (handlers.onSyncResponse) channel.on('broadcast', { event: 'sync:response' }, ({ payload }) => handlers.onSyncResponse(payload))
      if (handlers.onPresenceSync) channel.on('presence', { event: 'sync' }, () => handlers.onPresenceSync(channel.presenceState()))
      if (handlers.onPresenceLeave) channel.on('presence', { event: 'leave' }, ({ leftPresences }) => handlers.onPresenceLeave(leftPresences))

      channel.subscribe(async (status) => {
        handlers.onStatusChange?.(status)
        if (status === 'SUBSCRIBED') {
          await channel.track({ displayName, online_at: new Date().toISOString() })
        }
      })

      return channel
    },

    sendStroke(payload) {
      return channel.send({ type: 'broadcast', event: 'draw:stroke', payload })
    },
    sendClear(payload) {
      return channel.send({ type: 'broadcast', event: 'draw:clear', payload })
    },
    sendUndoRedo(payload) {
      return channel.send({ type: 'broadcast', event: 'draw:undoredo', payload })
    },
    sendChat(payload) {
      return channel.send({ type: 'broadcast', event: 'chat:message', payload })
    },
    requestSync(payload) {
      return channel.send({ type: 'broadcast', event: 'sync:request', payload })
    },
    respondSync(payload) {
      return channel.send({ type: 'broadcast', event: 'sync:response', payload })
    },

    unsubscribe() {
      supabase.removeChannel(channel)
    }
  }
}
