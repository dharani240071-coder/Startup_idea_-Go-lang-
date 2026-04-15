import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs';

export class WebSocketService {
    constructor() {
        this.client = null;
        this.onIdeaReceivedCallback = null;
    }

    connect(onConnectedCallback) {
        const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL || 'http://localhost:8085';
        // Use standard WebSocket instead of SockJS/STOMP for Go compatibility
        const wsUrl = wsBaseUrl.replace('http', 'ws') + '/ws';
        this.client = new WebSocket(wsUrl);
        
        this.client.onopen = () => {
            console.log('Connected to Go WebSocket');
            if (onConnectedCallback) onConnectedCallback();
        };

        this.client.onmessage = (event) => {
            const idea = JSON.parse(event.data);
            if (this.onIdeaReceivedCallback) {
                this.onIdeaReceivedCallback(idea);
            }
        };

        this.client.onerror = (error) => {
            console.error('WebSocket Error:', error);
        };

        this.client.onclose = () => {
            console.log('WebSocket Connection Closed');
            // Simple reconnect
            setTimeout(() => this.connect(onConnectedCallback), 5000);
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
            alert("Connection lost. Real-time features disabled.");
        }
    }

    onIdeaReceived(callback) {
        this.onIdeaReceivedCallback = callback;
    }
}
