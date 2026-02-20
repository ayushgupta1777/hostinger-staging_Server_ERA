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
      return res.json({
        success: true,
        data: {
          settings: {
            email: '',
            isActive: false,
            pickupLocations: [],
            autoCreateShipment: true,
            autoFetchTracking: true
          }
        }
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
      autoCreateShipment,
      autoFetchTracking,
      trackingUpdateInterval,
      defaultWeight,
      defaultLength,
      defaultBreadth,
      defaultHeight
    } = req.body;

    // Ensure only one active settings document
    let settings = await ShiprocketSettings.findOne({ isActive: true });

    if (!settings) {
      // Check if there are ANY settings documents and deactivate them just in case
      await ShiprocketSettings.updateMany({}, { isActive: false });

      settings = new ShiprocketSettings({
        email: (email || '').trim(),
        password: (password || '').trim(),
        isActive: true
      });
    } else {
      if (email) settings.email = email.trim();
      if (password) settings.password = password.trim();
    }

    // --- NEW: Validate credentials before final save ---
    if (email || password) {
      try {
        console.log(`[Shiprocket] Validating credentials for: ${settings.email}`);
        const testToken = await shiprocketService.getTokenWithCredentials(
          settings.email,
          settings.password
        );
        if (!testToken) {
          throw new Error('No token returned');
        }
        // Force refresh on next actual request since credentials changed
        shiprocketService.token = null;
      } catch (authError) {
        console.error(`[Shiprocket] Validation failed: ${authError.message}`);
        return next(new AppError(
          `Authentication Failed: ${authError.message}. Please check your Shiprocket login email/password. If credentials are correct, ensure 2FA is disabled on your account.`,
          401
        ));
      }
    }
    // --------------------------------------------------

    if (channelId) settings.channelId = channelId.trim();
    // ... rest of implementation stays the same ...
    if (autoCreateShipment !== undefined) settings.autoCreateShipment = autoCreateShipment;
    if (autoFetchTracking !== undefined) settings.autoFetchTracking = autoFetchTracking;
    if (trackingUpdateInterval) settings.trackingUpdateInterval = trackingUpdateInterval;
    if (defaultWeight) settings.defaultWeight = defaultWeight;
    if (defaultLength) settings.defaultLength = defaultLength;
    if (defaultBreadth) settings.defaultBreadth = defaultBreadth;
    if (defaultHeight) settings.defaultHeight = defaultHeight;

    await settings.save();

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
      const existingDefaultId = settings.pickupLocations.find(l => l.isDefault)?.id;

      settings.pickupLocations = locations.map((loc, index) => ({
        id: loc.id,
        name: loc.pickup_location,
        phone: loc.phone,
        email: loc.email,
        address: loc.address,
        city: loc.city,
        state: loc.state,
        pincode: loc.pin_code,
        // Preserve existing default or set first one as default if none exists
        isDefault: existingDefaultId ? (loc.id === existingDefaultId) : (index === 0)
      }));
      await settings.save();
    }

    res.json({
      success: true,
      data: { locations }
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

    // Auto-sync pickup locations if empty
    const settings = await ShiprocketSettings.findOne({ isActive: true });
    if (settings && (!settings.pickupLocations || settings.pickupLocations.length === 0)) {
      try {
        const locations = await shiprocketService.getPickupLocations();
        if (locations && locations.length > 0) {
          settings.pickupLocations = locations.map((loc, index) => ({
            id: loc.id,
            name: loc.pickup_location,
            phone: loc.phone,
            email: loc.email,
            address: loc.address,
            city: loc.city,
            state: loc.state,
            pincode: loc.pin_code,
            isDefault: index === 0
          }));
          await settings.save();
        }
      } catch (syncError) {
        console.error('Failed to auto-sync pickup locations:', syncError.message);
        // Continue anyway, createOrder will throw the appropriate error if still missing
      }
    }

    // Create shipment
    const result = await shiprocketService.createOrder(order);

    order.shiprocket = {
      orderId: result.orderId,
      shipmentId: result.shipmentId
    };

    // Generate AWB
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
      message: 'Shipment created successfully',
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

    settings.pickupLocations = settings.pickupLocations.map(loc => ({
      ...loc.toObject(),
      isDefault: loc.id === locationId
    }));

    await settings.save();

    res.json({
      success: true,
      message: 'Default pickup location updated',
      data: { settings }
    });
  } catch (error) {
    next(error);
  }
};