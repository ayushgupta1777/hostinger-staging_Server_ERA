// ============================================
// services/shiprocketService.js
// Complete Shiprocket Integration
// ============================================
import axios from 'axios';
import ShiprocketSettings from '../models/ShiprocketSettings.js';
import { AppError } from '../middleware/errorHandler.js';


const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in/v1/external';





class ShiprocketService {
  constructor() {
    this.token = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Get valid token (refresh if expired)
   */
  async getToken() {
    if (this.token && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.token;
    }

    const settings = await ShiprocketSettings.findOne({ isActive: true });
    if (!settings) {
      throw new AppError('Shiprocket settings not configured', 500);
    }

    // Check if stored token is still valid
    if (settings.token && settings.tokenExpiresAt && new Date() < settings.tokenExpiresAt) {
      this.token = settings.token;
      this.tokenExpiresAt = settings.tokenExpiresAt;
      return this.token;
    }

    // Login to get new token
    try {
      const response = await axios.post(`${SHIPROCKET_BASE_URL}/auth/login`, {
        email: settings.email,
        password: settings.password
      });

      this.token = response.data.token;
      // Token expires in 10 days
      this.tokenExpiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

      // Save token
      settings.token = this.token;
      settings.tokenExpiresAt = this.tokenExpiresAt;
      await settings.save();

      return this.token;
    } catch (error) {
      console.error('Shiprocket login error:', error.response?.data || error.message);
      throw new AppError('Failed to authenticate with Shiprocket', 500);
    }
  }

  /**
   * Make authenticated request to Shiprocket
   */
  async request(method, endpoint, data = null) {
    const token = await this.getToken();

    try {
      const config = {
        method,
        url: `${SHIPROCKET_BASE_URL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('Shiprocket API error:', error.response?.data || error.message);
      throw new AppError(
        error.response?.data?.message || 'Shiprocket API request failed',
        error.response?.status || 500
      );
    }
  }

  /**
   * Create order on Shiprocket
   */
  async createOrder(order) {
    const settings = await ShiprocketSettings.findOne({ isActive: true });
    if (!settings) {
      throw new AppError('Shiprocket settings not configured', 500);
    }

    const pickupLocation = settings.pickupLocations.find(loc => loc.isDefault);
    if (!pickupLocation) {
      throw new AppError('No default pickup location configured', 500);
    }

    // Prepare order items
    const orderItems = order.items.map(item => ({
      name: item.productTitle,
      sku: item.product.toString(),
      units: item.quantity,
      selling_price: item.finalPrice,
      discount: 0,
      tax: 0,
      hsn: item.hsn || ''
    }));

    // Calculate total weight
    const totalWeight = settings.defaultWeight * order.items.reduce((sum, item) => sum + item.quantity, 0);

    const shiprocketOrderData = {
      order_id: order.orderNo,
      order_date: order.createdAt.toISOString().split('T')[0],
      pickup_location: pickupLocation.name,
      channel_id: settings.channelId || '',
      comment: order.notes || '',
      billing_customer_name: order.shippingAddress.name,
      billing_last_name: '',
      billing_address: order.shippingAddress.addressLine1,
      billing_address_2: order.shippingAddress.addressLine2 || '',
      billing_city: order.shippingAddress.city,
      billing_pincode: order.shippingAddress.pincode,
      billing_state: order.shippingAddress.state,
      billing_country: order.shippingAddress.country,
      billing_email: order.user.email || 'customer@example.com',
      billing_phone: order.shippingAddress.phone,
      shipping_is_billing: true,
      order_items: orderItems,
      payment_method: order.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
      shipping_charges: order.shippingCost,
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: order.discount,
      sub_total: order.subtotal,
      length: settings.defaultLength,
      breadth: settings.defaultBreadth,
      height: settings.defaultHeight,
      weight: totalWeight
    };

    const response = await this.request('POST', '/orders/create/adhoc', shiprocketOrderData);
    
    return {
      orderId: response.order_id,
      shipmentId: response.shipment_id,
      status: response.status
    };
  }

  /**
   * Generate AWB (Airway Bill Number)
   */
  async generateAWB(shipmentId, courierId = null) {
    const data = {
      shipment_id: shipmentId
    };

    if (courierId) {
      data.courier_id = courierId;
    }

    const response = await this.request('POST', '/courier/assign/awb', data);
    
    return {
      awb: response.response.data.awb_code,
      courierName: response.response.data.courier_name,
      courierId: response.response.data.courier_id
    };
  }

  /**
   * Get available couriers for shipment
   */
  async getAvailableCouriers(shipmentId) {
    const response = await this.request('GET', `/courier/serviceability?shipment_id=${shipmentId}`);
    return response.data.available_courier_companies;
  }

  /**
   * Schedule pickup
   */
  async schedulePickup(shipmentId) {
    const response = await this.request('POST', '/courier/generate/pickup', {
      shipment_id: [shipmentId]
    });

    return {
      pickupScheduledDate: response.pickup_scheduled_date,
      pickupTokenNumber: response.pickup_token_number
    };
  }

  /**
   * Generate shipping label
   */
  async generateLabel(shipmentIds) {
    const response = await this.request('POST', '/courier/generate/label', {
      shipment_id: Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds]
    });

    return {
      labelUrl: response.label_url,
      labelCreatedDate: response.label_created_date
    };
  }

  /**
   * Generate manifest
   */
  async generateManifest(shipmentIds) {
    const response = await this.request('POST', '/manifests/generate', {
      shipment_id: Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds]
    });

    return {
      manifestUrl: response.manifest_url,
      manifestId: response.manifest_id
    };
  }

  /**
   * Track shipment
   */
  async trackShipment(shipmentId) {
    const response = await this.request('GET', `/courier/track/shipment/${shipmentId}`);
    
    return {
      trackingData: response.tracking_data,
      shipmentTrack: response.shipment_track,
      shipmentTrackActivities: response.shipment_track_activities
    };
  }

  /**
   * Cancel shipment
   */
  async cancelShipment(awbs) {
    const response = await this.request('POST', '/orders/cancel/shipment/awbs', {
      awbs: Array.isArray(awbs) ? awbs : [awbs]
    });

    return response;
  }

  /**
   * Create return order
   */
  async createReturn(returnRequest, originalOrder) {
    const settings = await ShiprocketSettings.findOne({ isActive: true });
    const pickupLocation = settings.pickupLocations.find(loc => loc.isDefault);

    const returnItems = returnRequest.items.map(item => ({
      name: item.product.title,
      sku: item.product._id.toString(),
      units: item.quantity,
      selling_price: item.price,
      discount: 0,
      tax: 0
    }));

    const returnOrderData = {
      order_id: returnRequest.returnNo,
      order_date: returnRequest.createdAt.toISOString().split('T')[0],
      channel_id: settings.channelId || '',
      pickup_customer_name: originalOrder.shippingAddress.name,
      pickup_last_name: '',
      pickup_address: originalOrder.shippingAddress.addressLine1,
      pickup_address_2: originalOrder.shippingAddress.addressLine2 || '',
      pickup_city: originalOrder.shippingAddress.city,
      pickup_state: originalOrder.shippingAddress.state,
      pickup_country: originalOrder.shippingAddress.country,
      pickup_pincode: originalOrder.shippingAddress.pincode,
      pickup_email: originalOrder.user.email,
      pickup_phone: originalOrder.shippingAddress.phone,
      pickup_isd_code: '91',
      shipping_customer_name: pickupLocation.name,
      shipping_last_name: '',
      shipping_address: pickupLocation.address,
      shipping_address_2: '',
      shipping_city: pickupLocation.city,
      shipping_country: 'India',
      shipping_pincode: pickupLocation.pincode,
      shipping_state: pickupLocation.state,
      shipping_email: pickupLocation.email,
      shipping_isd_code: '91',
      shipping_phone: pickupLocation.phone,
      order_items: returnItems,
      payment_method: 'Prepaid',
      sub_total: returnRequest.refundAmount,
      length: settings.defaultLength,
      breadth: settings.defaultBreadth,
      height: settings.defaultHeight,
      weight: settings.defaultWeight
    };

    const response = await this.request('POST', '/orders/create/return', returnOrderData);
    
    return {
      orderId: response.order_id,
      shipmentId: response.shipment_id
    };
  }

  /**
   * Get pickup locations
   */
  async getPickupLocations() {
    const response = await this.request('GET', '/settings/company/pickup');
    return response.data.shipping_address;
  }

  /**
   * Webhook verification
   */
  verifyWebhook(payload, signature, secret) {
    const crypto = require('crypto');
    const hash = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
    return hash === signature;
  }
}

export default new ShiprocketService();