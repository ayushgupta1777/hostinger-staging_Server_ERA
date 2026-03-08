import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Vendor from '../models/Vendor.js';
import Reseller from '../models/Reseller.js';
import Wallet from '../models/Wallet.js';
import OTP from '../models/OTP.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateReferralCode } from '../utils/helpers.js';
import { sendOTP_MSG91, verifyOTP_MSG91 } from '../utils/sms.js';

/**
 * Generate JWT token
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

/**
 * @desc    Send OTP for phone verification/login
 * @route   POST /api/auth/send-otp
 * @access  Public
 */
export const sendOTP = async (req, res, next) => {
  try {
    const { phone, type } = req.body; // type: signup, login

    if (!phone) {
      return next(new AppError('Phone number is required', 400));
    }

    // With MSG91, we don't need to generate or store the actual OTP string
    // MSG91 handles code generation and verification.
    // We just store a placeholder to track that a verification is pending.
    const expiresAt = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRE_MINUTES) || 10) * 60000);

    // Save/Update "verification pending" state in database
    await OTP.findOneAndUpdate(
      { phone },
      { otp: 'MSG91', type: type || 'verification', expiresAt, verified: false },
      { upsert: true, new: true }
    );

    // Send via MSG91
    const smsResult = await sendOTP_MSG91(phone);

    if (!smsResult.success) {
      return next(new AppError(`Failed to send OTP via MSG91: ${smsResult.message}`, 500));
    }

    res.json({
      success: true,
      message: 'OTP sent successfully via MSG91',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify OTP
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
export const verifyOTP = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    // Ask MSG91 if the OTP is correct
    const verificationResult = await verifyOTP_MSG91(phone, otp);

    if (!verificationResult.success) {
      return next(new AppError(verificationResult.message || 'Invalid OTP', 400));
    }

    // If MSG91 approves, update the local DB record so /register knows we are valid
    const otpRecord = await OTP.findOne({ phone });

    if (otpRecord) {
      if (otpRecord.expiresAt < new Date()) {
        return next(new AppError('OTP verification period expired', 400));
      }
      otpRecord.verified = true;
      await otpRecord.save();
    } else {
      // Edge case: MSG91 confirms it but no local tracking object was created? Let's just create a verified local footprint.
      const expiresAt = new Date(Date.now() + 10 * 60000);
      await OTP.create({ phone, otp: 'MSG91', type: 'verification', expiresAt, verified: true });
    }

    // Check if user already exists
    const user = await User.findOne({ phone });

    if (user) {
      // If user exists, provide token (auto-login)
      const token = generateToken(user._id);
      return res.json({
        success: true,
        message: 'OTP verified and logged in',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role
          },
          token,
          isNewUser: false
        }
      });
    }

    res.json({
      success: true,
      message: 'OTP verified successfully',
      data: { isNewUser: true }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role } = req.body;

    // 1. If phone is provided, verify it was validated via OTP
    if (phone) {
      const otpRecord = await OTP.findOne({ phone, verified: true });
      if (!otpRecord) {
        return next(new AppError('Phone number not verified. Please verify OTP first.', 400));
      }

      const phoneExists = await User.findOne({ phone });
      if (phoneExists) {
        return next(new AppError('Phone number already registered', 400));
      }

      // Cleanup OTP record after registration
      await OTP.deleteOne({ phone });
    }

    // 2. Check if email exists if provided
    if (email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return next(new AppError('Email already registered', 400));
      }
    }

    // Create user
    const user = await User.create({
      name,
      email: email || undefined,
      password: password || undefined,
      phone: phone || undefined,
      role: role || 'customer',
      phoneVerified: !!phone
    });

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
          phone: user.phone,
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
    const { email, password, phone, otp } = req.body;

    let user;

    // Option 1: Phone + OTP Login
    if (otp) {
      // Directly ask MSG91 if the OTP is accurate
      const verificationResult = await verifyOTP_MSG91(phone, otp);

      if (!verificationResult.success) {
        return next(new AppError(verificationResult.message || 'Invalid or expired OTP', 401));
      }

      // Cleanup local verification record if it exists
      await OTP.deleteOne({ phone });

      user = await User.findOne({ phone });
      if (!user) return next(new AppError('User not found. Please sign up.', 404));
    }
    // Option 2: Email + Password Login
    else if (email && password) {
      user = await User.findOne({ email }).select('+password');
      if (!user) return next(new AppError('Invalid credentials', 401));

      const isPasswordMatch = await user.comparePassword(password);
      if (!isPasswordMatch) return next(new AppError('Invalid credentials', 401));
    } else {
      return next(new AppError('Please provide email/password or phone/otp', 400));
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
          phone: user.phone,
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
    if (!user) return next(new AppError('User not found', 404));

    let profile = { user };

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
    const { name, phone, avatar, email } = req.body;

    const user = await User.findById(req.user.id);

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (avatar) user.avatar = avatar;
    if (email) user.email = email;

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
    if (!user.password && newPassword) {
      // For users who joined via OTP and want to set a password
      user.password = newPassword;
      await user.save();
      return res.json({ success: true, message: 'Password set successfully' });
    }

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
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = async (req, res, next) => {
  try {
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};
