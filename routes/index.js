// ============================================
// backend/routes/index.js
// ============================================
import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import productRoutes from './productRoutes.js';
import cartRoutes from './cartRoutes.js';
import orderRoutes from './orderRoutes.js';
import resellerRoutes from './resellerRoutes.js';
import vendorRoutes from './vendorRoutes.js';
import adminRoutes from './adminRoutes.js';
import webhookRoutes from './webhookRoutes.js';
import categoryRoutes from './categoryRoutes.js'; // ADD THIS


const router = express.Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes); // ADD THIS
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/reseller', resellerRoutes);
router.use('/vendor', vendorRoutes);
router.use('/admin', adminRoutes);
router.use('/webhooks', webhookRoutes);

export default router;