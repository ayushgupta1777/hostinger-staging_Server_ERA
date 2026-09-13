// backend/routes/adminRoutes.js
// ============================================
import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  getAllOrders,
  getOrderStats,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  hideOrder
} from '../controllers/adminOrderController.js';
import { broadcastNotification } from '../controllers/notificationController.js';

const router = express.Router();

// Protect all routes and require admin or developer role
router.use(protect, authorize('admin', 'developer'));

// Order routes
router.get('/orders', getAllOrders);
router.get('/orders/stats', getOrderStats);
router.get('/orders/:orderId', getOrderById);
router.put('/orders/:orderId/status', updateOrderStatus);
router.put('/orders/:orderId/cancel', cancelOrder);
router.put('/orders/:orderId/hide', hideOrder);

// Notification routes
router.post('/notifications/broadcast', broadcastNotification);

export default router;