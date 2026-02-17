import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Vendor from '../models/Vendor.js';
import Reseller from '../models/Reseller.js';
import Wallet from '../models/Wallet.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateReferralCode } from '../utils/helpers.js';

/**
 * Generate JWT token
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return next(new AppError('Email already registered', 400));
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: role || 'customer'
    });

    // If registering as vendor, create vendor profile
    if (role === 'vendor') {
      await Vendor.create({
        user: user._id,
        storeName: name + "'s Store",
        status: 'pending'
      });
    }

    // If registering as reseller, create reseller profile and wallet
    if (role === 'reseller') {
      const referralCode = await generateReferralCode();
      
      // Create wallet first
      const wallet = await Wallet.create({
        user: user._id
      });

      // Create reseller profile
      await Reseller.create({
        user: user._id,
        referralCode: referralCode,
        wallet: wallet._id
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if user exists (include password for comparison)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Check if user is active
    if (!user.isActive) {
      return next(new AppError('Account is deactivated', 401));
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          resellerApplication: user.resellerApplication
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    let profile = {
      user
    };

    // Get vendor details if user is vendor
    if (user.role === 'vendor') {
      const vendor = await Vendor.findOne({ user: user._id });
      profile.vendor = vendor;
    }

    // Get reseller details if user is reseller
    if (user.role === 'reseller') {
      const reseller = await Reseller.findOne({ user: user._id }).populate('wallet');
      profile.reseller = reseller;
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, avatar } = req.body;

    const user = await User.findById(req.user.id);

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (avatar) user.avatar = avatar;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change password
 * @route   PUT /api/auth/password
 * @access  Private
 */
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return next(new AppError('Current password is incorrect', 400));
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send OTP for phone verification
 * @route   POST /api/auth/send-otp
 * @access  Private
 */
export const sendOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // In production, send OTP via SMS service (Twilio, MSG91, etc.)
    // For now, we'll just return it in response (ONLY FOR DEVELOPMENT)
    console.log(`OTP for ${phone}: ${otp}`);

    // Store OTP in cache/database with expiry (implement with Redis in production)
    // For now, mock response
    res.json({
      success: true,
      message: 'OTP sent successfully',
      ...(process.env.NODE_ENV === 'development' && { otp }) // Only in dev
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify OTP
 * @route   POST /api/auth/verify-otp
 * @access  Private
 */
export const verifyOTP = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    // In production, verify OTP from cache/database
    // For now, mock verification (accept any 6-digit OTP)
    if (otp && otp.length === 6) {
      const user = await User.findById(req.user.id);
      user.phone = phone;
      user.phoneVerified = true;
      await user.save();

      res.json({
        success: true,
        message: 'Phone verified successfully',
        data: { user }
      });
    } else {
      return next(new AppError('Invalid OTP', 400));
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = async (req, res, next) => {
  try {
    // In a more complex setup with refresh tokens, 
    // you would invalidate the refresh token here
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};