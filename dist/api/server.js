"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.server = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("./routes/index.js");
const index_js_2 = require("../shared/db/index.js");
const demo_js_1 = require("../db/seed/demo.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
exports.app = app;
const server = http_1.default.createServer(app);
exports.server = server;
// Configure Socket.IO
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PATCH'],
    },
});
exports.io = io;
// Setup Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Initialize SQLite DB & ensure demo state is populated
(0, index_js_2.initDatabase)();
try {
    const hospCount = index_js_2.db.prepare('SELECT count(*) as c FROM hospitals').get()?.c || 0;
    if (hospCount === 0) {
        console.log('[LIFEGRID] Database empty — automatically seeding demo hospitals & fleet...');
        (0, demo_js_1.seedDemoScenario)();
    }
}
catch (err) {
    console.warn('[LIFEGRID] Auto-seed check skipped:', err);
}
// Mount API Router
app.use('/api', (0, index_js_1.createApiRouter)(io));
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        system: 'LIFEGRID — Rural Healthcare Accessibility & Emergency Coordination Engine',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
// Serve client if built
const clientDist = path_1.default.resolve(process.cwd(), 'client/dist');
app.use(express_1.default.static(clientDist));
app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
        return next();
    }
    const indexPath = path_1.default.join(clientDist, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.status(200).send('LIFEGRID API Server is operational. Frontend dev server runs on http://localhost:5173');
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
const HOST = '127.0.0.1';
server.listen(PORT, HOST, () => {
    console.log(`
=====================================================
  LIFEGRID API & Real-time Server Running
  Host:    ${HOST}
  Port:    ${PORT}
  Health:  http://${HOST}:${PORT}/health
  API:     http://${HOST}:${PORT}/api/dashboard/overview
=====================================================
  `);
});
