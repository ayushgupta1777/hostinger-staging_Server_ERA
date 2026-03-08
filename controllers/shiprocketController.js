// ============================================
// backend/controllers/shiprocketController.js
// Shiprocket Management Controller
// ============================================
import ShiprocketSettings from '../models/ShiprocketSettings.js';
import Order from '../models/Order.js';
import shiprocketService from '../services/shiprocketService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * @desc    Get Shiprocket settings
 * @route   GET /api/shiprocket/settings
 * @access  Private (Admin/Vendor)
 */
export const getSettings = async (req, res, next) => {
  try {
    let settings = await ShiprocketSettings.findOne({ isActive: true });

    if (!settings) {
      settings = await ShiprocketSettings.create({
        email: '',
        password: '',
        isActive: false,
        pickupLocations: [],
        autoCreateShipment: true,
        autoFetchTracking: true
      });
    }

    // Don't send password to frontend
    const settingsObj = settings.toObject();
    delete settingsObj.password;

    res.json({
      success: true,
      data: { settings: settingsObj }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Shiprocket settings
 * @route   PUT /api/shiprocket/settings
 * @access  Private (Admin)
 */
export const updateSettings = async (req, res, next) => {
  try {
    const {
      email,
      password,
      channelId,
      defaultPickupName,
      autoCreateShipment,
      autoFetchTracking,
      trackingUpdateInterval,
      defaultWeight,
      defaultLength,
      defaultBreadth,
      defaultHeight
    } = req.body;

    let settings = await ShiprocketSettings.findOne({ isActive: true });

    if (!settings) {
      settings = await ShiprocketSettings.create({
        email,
        password,
        isActive: true
      });
    } else {
      if (email) settings.email = email;
      if (password) settings.password = password;
      if (channelId !== undefined) settings.channelId = channelId;
      if (defaultPickupName !== undefined) settings.defaultPickupName = defaultPickupName;
      if (autoCreateShipment !== undefined) settings.autoCreateShipment = autoCreateShipment;
      if (autoFetchTracking !== undefined) settings.autoFetchTracking = autoFetchTracking;
      if (trackingUpdateInterval) settings.trackingUpdateInterval = trackingUpdateInterval;
      if (defaultWeight) settings.defaultWeight = defaultWeight;
      if (defaultLength) settings.defaultLength = defaultLength;
      if (defaultBreadth) settings.defaultBreadth = defaultBreadth;
      if (defaultHeight) settings.defaultHeight = defaultHeight;

      await settings.save();
    }

    // Don't send password back
    const settingsObj = settings.toObject();
    delete settingsObj.password;

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: { settings: settingsObj }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Test Shiprocket connection
 * @route   POST /api/shiprocket/test-connection
 * @access  Private (Admin)
 */
export const testConnection = async (req, res, next) => {
  try {
    const token = await shiprocketService.getToken();

    if (token) {
      res.json({
        success: true,
        message: 'Successfully connected to Shiprocket'
      });
    } else {
      throw new AppError('Failed to connect to Shiprocket', 500);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get pickup locations
 * @route   GET /api/shiprocket/pickup-locations
 * @access  Private (Admin)
 */
export const getPickupLocations = async (req, res, next) => {
  try {
    const locations = await shiprocketService.getPickupLocations();

    // Save locations to settings
    const settings = await ShiprocketSettings.findOne({ isActive: true });
    if (settings) {
      // Check if there is already a saved default we want to preserve
      const existingDefault = settings.pickupLocations.find(l => l.isDefault);

      settings.pickupLocations = locations.map((loc, index) => ({
        id: String(loc.id),
        name: loc.pickup_location,
        phone: loc.phone,
        email: loc.email,
        address: loc.address,
        address_2: loc.address_2 || '',
        city: loc.city,
        state: loc.state,
        pincode: loc.pin_code,
        // Keep previously chosen default by matching id; otherwise first location is default
        isDefault: existingDefault
          ? String(loc.id) === existingDefault.id
          : index === 0
      }));

      await settings.save();
      console.log(`✅ Synced ${locations.length} pickup location(s). Default: ${settings.pickupLocations.find(l => l.isDefault)?.name || 'none'}`);
    }

    res.json({
      success: true,
      data: {
        locations: settings ? settings.pickupLocations : locations
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create shipment for order
 * @route   POST /api/shiprocket/shipment/:orderId
 * @access  Private (Admin/Vendor)
 */
export const createShipment = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user')
      .populate('items.product');

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.shiprocket && order.shiprocket.shipmentId) {
      return next(new AppError('Shipment already created for this order', 400));
    }



    // Create shipment
    const result = await shiprocketService.createOrder(order);

    order.shiprocket = {
      orderId: result.orderId,
      shipmentId: result.shipmentId
    };

    // If Shiprocket accepted the order but didn't assign a shipment ID,
    // it means it's stuck in "NEW" status on their platform (often due to missing dimensions, categories, or channel settings)
    if (!result.shipmentId) {
      await order.save(); // Save the orderId at least
      return res.status(200).json({
        success: true,
        message: 'Order created in Shiprocket (Status: NEW), but no Shipment ID was generated. Please log into Shiprocket to move it to "Ready to Ship".',
        data: { order }
      });
    }

    // Generate AWB ONLY if we have a valid shipment ID
    const awbResult = await shiprocketService.generateAWB(result.shipmentId);
    order.shiprocket.awb = awbResult.awb;
    order.shiprocket.courierName = awbResult.courierName;
    order.trackingNumber = awbResult.awb;
    order.courierName = awbResult.courierName;

    // Schedule pickup
    const pickupResult = await shiprocketService.schedulePickup(result.shipmentId);
    order.shiprocket.pickupScheduledDate = pickupResult.pickupScheduledDate;

    await order.save();

    res.json({
      success: true,
      message: 'Shipment created and AWB generated successfully',
      data: { order }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate shipping label
 * @route   GET /api/shiprocket/label/:orderId
 * @access  Private (Admin/Vendor)
 */
export const generateLabel = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (!order.shiprocket || !order.shiprocket.shipmentId) {
      return next(new AppError('No shipment found for this order', 400));
    }

    const result = await shiprocketService.generateLabel(order.shiprocket.shipmentId);

    order.shiprocket.labelUrl = result.labelUrl;
    await order.save();

    res.json({
      success: true,
      data: { labelUrl: result.labelUrl }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate manifest
 * @route   GET /api/shiprocket/manifest/:orderId
 * @access  Private (Admin/Vendor)
 */
export const generateManifest = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (!order.shiprocket || !order.shiprocket.shipmentId) {
      return next(new AppError('No shipment found for this order', 400));
    }

    const result = await shiprocketService.generateManifest(order.shiprocket.shipmentId);

    order.shiprocket.manifestUrl = result.manifestUrl;
    await order.save();

    res.json({
      success: true,
      data: { manifestUrl: result.manifestUrl }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Track shipment
 * @route   GET /api/shiprocket/track/:orderId
 * @access  Private (Admin/Vendor)
 */
export const trackShipment = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (!order.shiprocket || !order.shiprocket.shipmentId) {
      return next(new AppError('No shipment found for this order', 400));
    }

    const tracking = await shiprocketService.trackShipment(order.shiprocket.shipmentId);

    res.json({
      success: true,
      data: { tracking }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel shipment
 * @route   DELETE /api/shiprocket/shipment/:orderId
 * @access  Private (Admin/Vendor)
 */
export const cancelShipment = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (!order.shiprocket || !order.shiprocket.awb) {
      return next(new AppError('No AWB found for this order', 400));
    }

    await shiprocketService.cancelShipment(order.shiprocket.awb);

    // Clear shipment details
    order.shiprocket = undefined;
    order.trackingNumber = undefined;
    order.courierName = undefined;
    await order.save();

    res.json({
      success: true,
      message: 'Shipment cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Schedule pickup
 * @route   POST /api/shiprocket/schedule-pickup/:orderId
 * @access  Private (Admin/Vendor)
 */
export const schedulePickup = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (!order.shiprocket || !order.shiprocket.shipmentId) {
      return next(new AppError('No shipment found for this order', 400));
    }

    const result = await shiprocketService.schedulePickup(order.shiprocket.shipmentId);

    order.shiprocket.pickupScheduledDate = result.pickupScheduledDate;
    await order.save();

    res.json({
      success: true,
      message: 'Pickup scheduled successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Set default pickup location
 * @route   PATCH /api/shiprocket/pickup-locations/:locationId/default
 * @access  Private (Admin)
 */
export const setDefaultPickupLocation = async (req, res, next) => {
  try {
    const { locationId } = req.params;

    const settings = await ShiprocketSettings.findOne({ isActive: true });
    if (!settings) {
      return next(new AppError('Shiprocket settings not found', 404));
    }

    const locationExists = settings.pickupLocations.some(loc => loc.id === locationId);
    if (!locationExists) {
      return next(new AppError('Pickup location not found. Please sync locations first.', 404));
    }

    // Mark only the chosen one as default
    settings.pickupLocations = settings.pickupLocations.map(loc => ({
      ...loc.toObject(),
      isDefault: loc.id === locationId
    }));

    await settings.save();

    const chosen = settings.pickupLocations.find(l => l.isDefault);
    console.log(`✅ Default pickup location set to: ${chosen?.name}`);

    res.json({
      success: true,
      message: `"${chosen?.name}" is now the default pickup location`,
      data: { pickupLocations: settings.pickupLocations }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Bulk sync pending orders
 * @route   POST /api/shiprocket/bulk-sync
 * @access  Private (Admin)
 */
export const bulkSyncPendingOrders = async (req, res, next) => {
  try {
    const settings = await ShiprocketSettings.findOne({ isActive: true });

    if (!settings) {
      return next(new AppError('Shiprocket settings not configured', 400));
    }

    // Find confirmed or processing orders without shipmentId
    const pendingOrders = await Order.find({
      orderStatus: { $in: ['confirmed', 'processing'] },
      $or: [
        { 'shiprocket.shipmentId': { $exists: false } },
        { 'shiprocket.shipmentId': null }
      ]
    }).populate('user').populate('items.product').limit(100); // 100 max per invoke manually

    if (pendingOrders.length === 0) {
      return res.json({
        success: true,
        message: 'No pending orders found to sync.'
      });
    }

    // Process asynchronously so we don't block the request
    setTimeout(async () => {
      console.log(`[Shiprocket Manual Bulk Sync] Started processing ${pendingOrders.length} orders...`);
      for (const order of pendingOrders) {
        try {
          await shiprocketService.processOrderShipment(order);
          // Standard delay to avoid API rate limits
          await new Promise(resolve => setTimeout(resolve, 350));
        } catch (err) {
          console.error(`[Bulk Sync] Failed for order ${order.orderNo}:`, err.message);
        }
      }
      console.log(`[Shiprocket Manual Bulk Sync] Completed.`);
    }, 0);

    res.json({
      success: true,
      message: `Bulk sync started for ${pendingOrders.length} pending orders. This process will complete in the background.`
    });
  } catch (error) {
    next(error);
  }
};