import { useEffect, useRef, useCallback, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

/**
 * Hook for real-time drive updates via WebSocket.
 * Connects to the backend STOMP broker and receives file/folder events.
 * 
 * @param {string} username - Current user's username for subscription
 * @param {Object} handlers - Event handlers for different event types
 * @param {Function} handlers.onFileUploaded - Called when a file is uploaded
 * @param {Function} handlers.onFileDeleted - Called when a file is deleted/trashed
 * @param {Function} handlers.onFolderCreated - Called when a folder is created
 * @param {Function} handlers.onFileRestored - Called when a file is restored
 * @param {Function} handlers.onStarChanged - Called when star status changes
 */
export const useDriveWebSocket = (username, handlers = {}) => {
    const clientRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState(null);

    const handleMessage = useCallback((message) => {
        try {
            const event = JSON.parse(message.body);
            setLastEvent(event);

            // Route to appropriate handler based on event type
            switch (event.type) {
                case 'FILE_UPLOADED':
                    handlers.onFileUploaded?.(event);
                    break;
                case 'FILE_TRASHED':
                case 'FILE_PERMANENTLY_DELETED':
                    handlers.onFileDeleted?.(event);
                    break;
                case 'FOLDER_CREATED':
                    handlers.onFolderCreated?.(event);
                    break;
                case 'FILE_RESTORED':
                    handlers.onFileRestored?.(event);
                    break;
                case 'STAR_CHANGED':
                    handlers.onStarChanged?.(event);
                    break;
                case 'VERSION_CREATED':
                    handlers.onVersionCreated?.(event);
                    break;
                default:
                    console.log('Unknown event type:', event.type);
            }
        } catch (e) {
            console.error('Error parsing WebSocket message:', e);
        }
    }, [handlers]);

    useEffect(() => {
        if (!username) return;

        // Create STOMP client over SockJS
        const client = new Client({
            webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
            debug: (str) => {
                // Uncomment for debugging
                // console.log('[STOMP]', str);
            },
            onConnect: () => {
                console.log('[WebSocket] Connected');
                setConnected(true);

                // Subscribe to user-specific topic
                client.subscribe(`/topic/drive/${username}`, handleMessage);
            },
            onDisconnect: () => {
                console.log('[WebSocket] Disconnected');
                setConnected(false);
            },
            onStompError: (frame) => {
                console.error('[WebSocket] STOMP Error:', frame.headers['message']);
            }
        });

        client.activate();
        clientRef.current = client;

        return () => {
            if (clientRef.current) {
                clientRef.current.deactivate();
            }
        };
    }, [username, handleMessage]);

    return {
        connected,
        lastEvent,
        client: clientRef.current
    };
};

export default useDriveWebSocket;
