import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createApiRouter } from './routes/index.js';
import { initDatabase, db } from '../shared/db/index.js';
import { seedDemoScenario } from '../db/seed/demo.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH'],
  },
});

// Setup Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize SQLite DB & ensure demo state is populated
initDatabase();
try {
  const hospCount = db.prepare('SELECT count(*) as c FROM hospitals').get()?.c || 0;
  if (hospCount === 0) {
    console.log('[LIFEGRID] Database empty — automatically seeding demo hospitals & fleet...');
    seedDemoScenario();
  }
} catch (err) {
  console.warn('[LIFEGRID] Auto-seed check skipped:', err);
}

// Mount API Router
app.use('/api', createApiRouter(io));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'LIFEGRID — Rural Healthcare Accessibility & Emergency Coordination Engine',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Serve client
const clientDist = path.resolve(process.cwd(), 'public');
app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    return next();
  }
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('LIFEGRID API Server is operational.');
    }
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[WebSocket] Client disconnected: ${socket.id}`);
  });
});

const PORT = Number(process.env.PORT) || 3001;

server.listen(PORT, () => {
  console.log(`
=====================================================
  LIFEGRID API & Real-time Server Running
  Port:    ${PORT}
  Health:  http://127.0.0.1:${PORT}/health
  API:     http://127.0.0.1:${PORT}/api/dashboard/overview
  App:     http://127.0.0.1:${PORT}/
=====================================================
  `);
});

export { app, server, io };
