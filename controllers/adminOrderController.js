// 1. Admin Order Controller
// backend/controllers/adminOrderController.js
// ============================================
import Order from '../models/Order.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * @desc    Get all orders with filters
 * @route   GET /api/admin/orders
 * @access  Private (Admin)
 */
export const getAllOrders = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    // Build query
    const query = {};
    if (status && status !== 'all') {
      query.orderStatus = status;
    }
    if (search) {
      query.$or = [
        { orderNo: { $regex: search, $options: 'i' } },
        { 'user.name': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.product', 'title images')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get order statistics
 * @route   GET /api/admin/orders/stats
 * @access  Private (Admin)
 */
export const getOrderStats = async (req, res, next) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: 'pending' });
    const confirmedOrders = await Order.countDocuments({ orderStatus: 'confirmed' });
    const processingOrders = await Order.countDocuments({ orderStatus: 'processing' });
    const shippedOrders = await Order.countDocuments({ orderStatus: 'shipped' });
    const deliveredOrders = await Order.countDocuments({ orderStatus: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ orderStatus: 'cancelled' });

    // Calculate total revenue (only from delivered orders)
    const revenueResult = await Order.aggregate([
      { $match: { orderStatus: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // Get recent orders
    const recentOrders = await Order.find()
      .populate('user', 'name')
      .sort('-createdAt')
      .limit(5);

    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        confirmedOrders,
        processingOrders,
        shippedOrders,
        deliveredOrders,
        cancelledOrders,
        totalRevenue,
        recentOrders
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single order (admin)
 * @route   GET /api/admin/orders/:orderId
 * @access  Private (Admin)
 */
export const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email phone')
      .populate('items.product', 'title images');

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    res.json({
      success: true,
      data: { order }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update order status
 * @route   PUT /api/admin/orders/:orderId/status
 * @access  Private (Admin)
 */
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Validate status transition
    const validStatuses = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return next(new AppError('Invalid status', 400));
    }

    order.orderStatus = status;

    // Update timestamps
    if (status === 'confirmed') order.confirmedAt = new Date();
    if (status === 'processing') order.processingAt = new Date();
    if (status === 'packed') order.packedAt = new Date();
    if (status === 'shipped') order.shippedAt = new Date();
    if (status === 'delivered') {
      order.deliveredAt = new Date();
      order.paymentStatus = 'completed';
      
      // Calculate return window
      const returnWindowDays = 7;
      order.returnWindowEndDate = new Date(Date.now() + returnWindowDays * 24 * 60 * 60 * 1000);
    }
    if (status === 'cancelled') order.cancelledAt = new Date();

    await order.save();

    // TODO: Send notification to customer

    res.json({
      success: true,
      message: 'Order status updated',
      data: { order }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel order (admin)
 * @route   PUT /api/admin/orders/:orderId/cancel
 * @access  Private (Admin)
 */
export const cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (['delivered', 'cancelled'].includes(order.orderStatus)) {
      return next(new AppError('Cannot cancel this order', 400));
    }

    order.orderStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = reason;

    // Restore stock
    const Product = (await import('../models/Product.js')).default;
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } }
      );
    }

    await order.save();

    res.json({
      success: true,
      message: 'Order cancelled',
      data: { order }
    });
  } catch (error) {
    next(error);
  }
};
