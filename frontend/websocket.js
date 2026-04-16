import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs';

export class WebSocketService {
    constructor() {
        this.client = null;
        this.onIdeaReceivedCallback = null;
        this.onStatusChangeCallback = null;
        this.status = 'disconnected'; // 'disconnected', 'connecting', 'connected'
    }

    setStatus(newStatus) {
        this.status = newStatus;
        if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback(newStatus);
        }
    }

    connect(onConnectedCallback) {
        this.setStatus('connecting');
        const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL || 'http://localhost:8085';
        const wsUrl = wsBaseUrl.replace('http', 'ws') + '/ws';
        
        console.log(`Attempting connection to ${wsUrl}...`);
        this.client = new WebSocket(wsUrl);
        
        this.client.onopen = () => {
            console.log('✅ Connected to Go WebSocket');
            this.setStatus('connected');
            if (onConnectedCallback) onConnectedCallback();
        };

        this.client.onmessage = (event) => {
            try {
                const idea = JSON.parse(event.data);
                if (this.onIdeaReceivedCallback) {
                    this.onIdeaReceivedCallback(idea);
                }
            } catch (err) {
                console.error('Failed to parse WebSocket message:', err);
            }
        };

        this.client.onerror = (error) => {
            console.error('❌ WebSocket Error:', error);
            this.setStatus('disconnected');
        };

        this.client.onclose = (event) => {
            console.log(`WebSocket Connection Closed (Code: ${event.code})`);
            this.setStatus('disconnected');
            // Reconnect after 5 seconds
            setTimeout(() => {
                if (this.status === 'disconnected') {
                    this.connect(onConnectedCallback);
                }
            }, 5000);
        };
    }

    sendIdea(title, description, author) {
        if (this.client && this.client.readyState === WebSocket.OPEN) {
            this.client.send(JSON.stringify({ 
                title: title + ' (by ' + author + ')', 
                description: description 
            }));
        } else {
            console.warn("WebSocket not connected!");
            alert("Connection lost. Real-time features disabled. Please check if your backend is running.");
        }
    }

    onIdeaReceived(callback) {
        this.onIdeaReceivedCallback = callback;
    }

    onStatusChange(callback) {
        this.onStatusChangeCallback = callback;
    }
}
