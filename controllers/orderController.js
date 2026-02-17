import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Wallet from '../models/Wallet.js';
import { AppError } from '../middleware/errorHandler.js';

// Generate unique order number
const generateOrderNumber = async () => {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const count = await Order.countDocuments();
  return `ORD${yyyy}${mm}${dd}${String(count + 1).padStart(5, '0')}`;
};

export const createOrder = async (req, res, next) => {
  try {
    const { shippingAddress, paymentMethod } = req.body;

    console.log('📦 CREATE ORDER - Received:', { shippingAddress, paymentMethod });

    // Validate
    if (!shippingAddress || !shippingAddress.name || !shippingAddress.phone) {
      return next(new AppError('Complete address required', 400));
    }

    if (!paymentMethod || !['cod', 'upi', 'card'].includes(paymentMethod)) {
      return next(new AppError('Invalid payment method', 400));
    }

    // Get cart
    const cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product', 'title stock');

    if (!cart || cart.items.length === 0) {
      return next(new AppError('Cart is empty', 400));
    }

    console.log('✅ Cart items:', cart.items.length);

    // Validate stock
    for (const item of cart.items) {
      const product = item.product;
      if (product.stock < item.quantity) {
        return next(new AppError(`${product.title} out of stock`, 400));
      }
    }

    // Calculate totals
    const subtotal = cart.totalPrice;
    const shipping = subtotal >= 500 ? 0 : 50;
    const tax = Math.round(subtotal * 0.18);
    const total = subtotal + shipping + tax;

    // Generate order number
    const orderNo = await generateOrderNumber();

    // Calculate reseller earnings
    let totalResellerEarning = 0;
    cart.items.forEach(item => {
      totalResellerEarning += item.resellPrice * item.quantity;
    });

    console.log('💰 Reseller earning:', totalResellerEarning);

    // ✅ FIX: Correct status based on payment method
    let orderStatus, paymentStatus;
    
    if (paymentMethod === 'cod') {
      // COD orders are immediately confirmed
      orderStatus = 'confirmed';
      paymentStatus = 'pending'; // Will be 'completed' after delivery
    } else {
      // Online payment orders start as pending
      orderStatus = 'pending';
      paymentStatus = 'pending'; // Will be updated after Razorpay verification
    }

    // Create order
    const order = await Order.create({
      orderNo,
      user: req.user.id,
      items: cart.items.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        basePrice: item.basePrice,
        resellPrice: item.resellPrice,
        finalPrice: item.finalPrice
      })),
      shippingAddress,
      subtotal,
      shipping,
      tax,
      total,
      paymentMethod,
      paymentStatus,      // ✅ Dynamic based on payment method
      orderStatus,        // ✅ Dynamic based on payment method
      confirmedAt: paymentMethod === 'cod' ? new Date() : null, // ✅ COD confirmed immediately
      resellerEarning: totalResellerEarning,
      resellerEarningStatus: 'pending',
      returnWindowEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    console.log('✅ Order created:', order.orderNo, 'Status:', order.orderStatus);

    // Deduct stock
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(
        item.product._id,
        { $inc: { stock: -item.quantity } }
      );
    }

    // Clear cart
    cart.items = [];
    await cart.save();

    // Populate for response
    await order.populate('items.product', 'title images');

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order }
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    next(error);
  }
};

export const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate('items.product', 'title images')
      .sort('-createdAt');

    res.json({ success: true, data: { orders } });
  } catch (error) {
    next(error);
  }
};

export const getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('items.product', 'title images');

    if (!order) return next(new AppError('Order not found', 404));

    // if (order.user.toString() !== req.user.id) {
    //   return next(new AppError('Not authorized', 403));
    // }

    res.json({ success: true, data: { order } });
  } catch (error) {
    next(error);
  }
};

export const updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentStatus, paymentId } = req.body;
    const order = await Order.findById(req.params.orderId);

    if (!order) return next(new AppError('Order not found', 404));

    order.paymentStatus = paymentStatus;
    if (paymentId) order.paymentId = paymentId;

    if (paymentStatus === 'completed') {
      order.orderStatus = 'confirmed';
      order.confirmedAt = new Date();

      // Auto add to reseller wallet as pending
      if (order.resellerEarning > 0) {
        const wallet = await Wallet.findOne({ user: order.user });
        if (wallet) {
          wallet.pendingBalance += order.resellerEarning;
          await wallet.save();
        }
      }
    }

    await order.save();
    res.json({ success: true, data: { order } });
  } catch (error) {
    next(error);
  }
};

export const cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;
    
    const order = await Order.findById(req.params.orderId);
    if (!order) return next(new AppError('Order not found', 404));

    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new AppError('Not authorized', 403));
    }

    // ✅ FIX: Check if cancellation is allowed
    const cancellableStatuses = ['pending', 'confirmed', 'processing'];
    if (!cancellableStatuses.includes(order.orderStatus)) {
      return next(new AppError(`Cannot cancel order in ${order.orderStatus} status`, 400));
    }

    // ✅ PREVENT CANCELLING SHIPPED ORDERS
    if (order.shiprocket && order.shiprocket.shipmentId) {
      return next(new AppError('Cannot cancel shipped orders. Please request a return instead.', 400));
    }

    order.orderStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelledBy = req.user.id;
    order.cancellationReason = reason || 'Customer requested cancellation';

    // ✅ RESTORE STOCK
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } }
      );
    }

    // ✅ HANDLE REFUNDS (ONLY FOR ONLINE PAYMENTS)
    if (order.paymentMethod !== 'cod' && order.paymentStatus === 'completed') {
      // Mark for refund (actual refund processed by admin)
      order.paymentStatus = 'refunded';
      // TODO: Implement Razorpay refund API call here
    }

    await order.save();

    // ✅ SEND NOTIFICATION
    await notificationService.sendNotification({
      user: order.user,
      type: 'order_cancelled',
      title: 'Order Cancelled',
      message: `Your order ${order.orderNo} has been cancelled.`,
      referenceId: order._id.toString(),
      referenceModel: 'Order'
    });

    res.json({ 
      success: true, 
      message: 'Order cancelled successfully', 
      data: { order } 
    });
  } catch (error) {
    next(error);
  }
};

export default { createOrder, getMyOrders, getOrder, updatePaymentStatus, cancelOrder };

/**
 * @desc    Update order status
 * @route   PUT /api/orders/:orderId/status
 * @access  Private (Vendor/Admin)
 */
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    order.orderStatus = status;

    if (status === 'confirmed') order.confirmedAt = new Date();
    if (status === 'processing') order.processingAt = new Date();
    if (status === 'packed') order.packedAt = new Date();
    if (status === 'shipped') order.shippedAt = new Date();
    if (status === 'delivered') {
      order.deliveredAt = new Date();
      order.paymentStatus = 'completed';
      
      // Calculate return window end date
      const returnWindowDays = order.returnWindow || 7;
      order.returnWindowEndDate = new Date(Date.now() + returnWindowDays * 24 * 60 * 60 * 1000);
    }

    await order.save();

    // Send notification
    await notificationService.sendNotification({
      user: order.user,
      type: `order_${status}`,
      title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: `Your order ${order.orderNo} is now ${status}.`,
      referenceId: order._id.toString(),
      referenceModel: 'Order'
    });

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
 * @desc    Get order tracking
 * @route   GET /api/orders/:orderId/tracking
 * @access  Private
 */
export const getOrderTracking = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);
    
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new AppError('Not authorized', 403));
    }

    let trackingData = null;

    // Get tracking from Shiprocket if shipment exists
    if (order.shiprocket && order.shiprocket.shipmentId) {
      try {
        trackingData = await shiprocketService.trackShipment(order.shiprocket.shipmentId);
        
        // Update tracking events in order
        if (trackingData.shipmentTrackActivities) {
          order.trackingEvents = trackingData.shipmentTrackActivities.map(event => ({
            status: event.activity,
            description: event.sr_status_label || event.activity,
            location: event.location || '',
            timestamp: new Date(event.date)
          }));
          
          await order.save();
        }
      } catch (error) {
        console.error('Failed to fetch tracking:', error.message);
      }
    }

    res.json({
      success: true,
      data: {
        order: {
          orderNo: order.orderNo,
          status: order.orderStatus,
          trackingNumber: order.trackingNumber,
          courierName: order.courierName,
          trackingEvents: order.trackingEvents
        },
        shiprocketTracking: trackingData
      }
    });
  } catch (error) {
    next(error);
  }
};

