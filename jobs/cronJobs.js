import cron from 'node-cron';
import Order from '../models/Order.js';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import User from '../models/User.js';
import shiprocketService from '../services/shiprocketService.js';
import notificationService from '../services/notificationService.js';

/**
 * Credit reseller earnings after return window ends
 * Runs every hour
 */
export const creditResellerEarningsJob = cron.schedule('0 * * * *', async () => {
  console.log('🔄 Running credit reseller earnings job...');
  
  try {
    const now = new Date();
    
    // Find delivered orders where return window has ended and earnings not yet credited
    const eligibleOrders = await Order.find({
      orderStatus: 'delivered',
      returnWindowEndDate: { $lt: now },
      resellerEarningStatus: 'pending',
      reseller: { $exists: true, $ne: null },
      totalResellerEarning: { $gt: 0 }
    }).populate('reseller');

    console.log(`Found ${eligibleOrders.length} orders eligible for reseller credit`);

    for (const order of eligibleOrders) {
      try {
        // Get or create wallet
        let wallet = await Wallet.findOne({ user: order.reseller });
        
        if (!wallet) {
          wallet = await Wallet.create({
            user: order.reseller,
            balance: 0,
            totalEarned: 0
          });
        }

        // Credit wallet
        wallet.balance += order.totalResellerEarning;
        wallet.totalEarned += order.totalResellerEarning;
        await wallet.save();

        // Create transaction record
        await WalletTransaction.create({
          wallet: wallet._id,
          user: order.reseller,
          type: 'credit',
          source: 'resell_earning',
          amount: order.totalResellerEarning,
          balanceAfter: wallet.balance,
          description: `Resell earning from order ${order.orderNo}`,
          referenceId: order._id.toString(),
          referenceModel: 'Order',
          status: 'completed'
        });

        // Update order
        order.resellerEarningStatus = 'credited';
        order.resellerEarningCreditedAt = new Date();
        await order.save();

        // Send notification to reseller
        await notificationService.sendNotification({
          user: order.reseller,
          type: 'wallet_credited',
          title: 'Earnings Credited',
          message: `₹${order.totalResellerEarning} has been credited to your wallet from order ${order.orderNo}`,
          referenceId: wallet._id.toString(),
          referenceModel: 'Wallet'
        });

        console.log(`✅ Credited ₹${order.totalResellerEarning} to reseller for order ${order.orderNo}`);
      } catch (error) {
        console.error(`❌ Failed to credit order ${order.orderNo}:`, error.message);
      }
    }

    console.log('✅ Credit reseller earnings job completed');
  } catch (error) {
    console.error('❌ Credit reseller earnings job failed:', error);
  }
});

/**
 * Update order tracking from Shiprocket
 * Runs every 30 minutes
 */
export const updateTrackingJob = cron.schedule('*/30 * * * *', async () => {
  console.log('🔄 Running tracking update job...');
  
  try {
    // Find orders that are shipped but not delivered
    const activeOrders = await Order.find({
      orderStatus: { $in: ['shipped'] },
      'shiprocket.shipmentId': { $exists: true }
    });

    console.log(`Found ${activeOrders.length} active shipments to track`);

    for (const order of activeOrders) {
      try {
        const trackingData = await shiprocketService.trackShipment(order.shiprocket.shipmentId);
        
        // Update tracking events
        if (trackingData.shipmentTrackActivities) {
          order.trackingEvents = trackingData.shipmentTrackActivities.map(event => ({
            status: event.activity,
            description: event.sr_status_label || event.activity,
            location: event.location || '',
            timestamp: new Date(event.date)
          }));
        }

        // Check if delivered
        const latestStatus = trackingData.trackingData?.track_status;
        if (latestStatus === 'delivered' || latestStatus === 'Delivered') {
          order.orderStatus = 'delivered';
          order.deliveredAt = new Date();
          
          // Calculate return window end date
          const returnWindowDays = order.returnWindow || 7;
          order.returnWindowEndDate = new Date(Date.now() + returnWindowDays * 24 * 60 * 60 * 1000);
          
          // Send notification
          await notificationService.sendNotification({
            user: order.user,
            type: 'order_delivered',
            title: 'Order Delivered',
            message: `Your order ${order.orderNo} has been delivered successfully.`,
            referenceId: order._id.toString(),
            referenceModel: 'Order'
          });
        }

        await order.save();
        
        console.log(`✅ Updated tracking for order ${order.orderNo}`);
      } catch (error) {
        console.error(`❌ Failed to update tracking for order ${order.orderNo}:`, error.message);
      }
    }

    console.log('✅ Tracking update job completed');
  } catch (error) {
    console.error('❌ Tracking update job failed:', error);
  }
});

/**
 * Clean up expired carts
 * Runs daily at 2 AM
 */
export const cleanupCartsJob = cron.schedule('0 2 * * *', async () => {
  console.log('🔄 Running cart cleanup job...');
  
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Clear items from carts not updated in 30 days
    const result = await Cart.updateMany(
      { 
        updatedAt: { $lt: thirtyDaysAgo },
        'items.0': { $exists: true }
      },
      { 
        $set: { items: [] }
      }
    );

    console.log(`✅ Cleaned up ${result.modifiedCount} expired carts`);
  } catch (error) {
    console.error('❌ Cart cleanup job failed:', error);
  }
});

/**
 * Send reminder for pending reseller applications
 * Runs daily at 10 AM
 */
export const resellerApplicationReminderJob = cron.schedule('0 10 * * *', async () => {
  console.log('🔄 Running reseller application reminder job...');
  
  try {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Find pending applications older than 2 days
    const pendingApplications = await User.find({
      'resellerApplication.status': 'pending',
      'resellerApplication.appliedAt': { $lt: twoDaysAgo }
    });

    console.log(`Found ${pendingApplications.length} pending applications`);

    // Send notification to admins
    const admins = await User.find({ role: 'admin' });
    
    for (const admin of admins) {
      await notificationService.sendNotification({
        user: admin._id,
        type: 'reseller_application',
        title: 'Pending Reseller Applications',
        message: `${pendingApplications.length} reseller applications are pending review.`,
        data: { count: pendingApplications.length }
      });
    }

    console.log('✅ Reseller application reminder sent');
  } catch (error) {
    console.error('❌ Reseller application reminder job failed:', error);
  }
});

/**
 * Auto-cancel unpaid orders after 24 hours
 * Runs every hour
 */
export const cancelUnpaidOrdersJob = cron.schedule('0 * * * *', async () => {
  console.log('🔄 Running unpaid orders cancellation job...');
  
  try {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const unpaidOrders = await Order.find({
      orderStatus: 'pending',
      paymentMethod: { $in: ['online', 'upi', 'card'] },
      paymentStatus: 'pending',
      createdAt: { $lt: oneDayAgo }
    });

    console.log(`Found ${unpaidOrders.length} unpaid orders to cancel`);

    for (const order of unpaidOrders) {
      try {
        order.orderStatus = 'cancelled';
        order.cancelledAt = new Date();
        order.cancellationReason = 'Payment not completed within 24 hours';

        // Restore stock
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { stock: item.quantity }
          });
        }

        await order.save();

        // Send notification
        await notificationService.sendNotification({
          user: order.user,
          type: 'order_cancelled',
          title: 'Order Cancelled',
          message: `Your order ${order.orderNo} has been cancelled due to pending payment.`,
          referenceId: order._id.toString(),
          referenceModel: 'Order'
        });

        console.log(`✅ Cancelled unpaid order ${order.orderNo}`);
      } catch (error) {
        console.error(`❌ Failed to cancel order ${order.orderNo}:`, error.message);
      }
    }

    console.log('✅ Unpaid orders cancellation job completed');
  } catch (error) {
    console.error('❌ Unpaid orders cancellation job failed:', error);
  }
});

/**
 * Initialize all cron jobs
 */
export const initializeCronJobs = () => {
  console.log('🚀 Initializing cron jobs...');
  
  creditResellerEarningsJob.start();
  updateTrackingJob.start();
  cleanupCartsJob.start();
  resellerApplicationReminderJob.start();
  cancelUnpaidOrdersJob.start();
  
  console.log('✅ All cron jobs initialized');
};

/**
 * Stop all cron jobs (for graceful shutdown)
 */
export const stopCronJobs = () => {
  console.log('🛑 Stopping cron jobs...');
  
  creditResellerEarningsJob.stop();
  updateTrackingJob.stop();
  cleanupCartsJob.stop();
  resellerApplicationReminderJob.stop();
  cancelUnpaidOrdersJob.stop();
  
  console.log('✅ All cron jobs stopped');
};