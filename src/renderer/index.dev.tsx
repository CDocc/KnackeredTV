import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Mock electron API for development
if (!window.electron) {
  (window as any).electron = {
    ipcRenderer: {
      invoke: async (channel: string, data?: any) => {
        console.log('[Mock IPC]', channel, data);
        
        // Mock responses
        if (channel === 'get-profiles') {
          return { success: true, data: [] };
        }
        if (channel === 'authenticate') {
          return {
            success: true,
            data: {
              username: 'testuser',
              password: 'testpass',
              auth_token: 'token123',
              status: 'Active',
              exp_date: Math.floor(Date.now() / 1000) + 30 * 86400,
              max_connections: 2,
              allowed_output_formats: ['m3u8', 'ts'],
            },
          };
        }
        if (channel === 'get-live-categories') {
          return {
            success: true,
            data: [
              { category_id: '1', category_name: 'Sports' },
              { category_id: '2', category_name: 'Movies' },
              { category_id: '3', category_name: 'News' },
            ],
          };
        }
        if (channel === 'get-live-channels') {
          return {
            success: true,
            data: [
              {
                id: '1',
                name: 'Channel 1',
                logo: '',
                categoryId: data?.categoryId || '1',
                categoryName: 'Sports',
                streamUrl: 'https://example.com/stream1.ts',
              },
              {
                id: '2',
                name: 'Channel 2',
                logo: '',
                categoryId: data?.categoryId || '1',
                categoryName: 'Sports',
                streamUrl: 'https://example.com/stream2.ts',
              },
            ],
          };
        }
        
        return { success: false, error: 'Unknown channel' };
      },
      send: () => {},
      on: () => {},
      once: () => {},
    },
  };
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
