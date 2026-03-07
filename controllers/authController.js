import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Vendor from '../models/Vendor.js';
import Reseller from '../models/Reseller.js';
import Wallet from '../models/Wallet.js';
import { admin } from '../config/firebase.js';
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
 * @desc    Verify Firebase ID Token and return user data
 * @route   POST /api/auth/verify-firebase
 * @access  Public
 */
export const verifyFirebaseToken = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return next(new AppError('Firebase ID token is required', 400));
    }

    // Verify the ID token using Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { phone_number: phone, uid: firebaseUid } = decodedToken;

    if (!phone) {
      return next(new AppError('Phone number not found in token', 400));
    }

    // Check if user already exists
    let user = await User.findOne({ phone });

    if (user) {
      // If user exists, provide token (auto-login)
      user.lastLoginAt = new Date();
      await user.save();

      const token = generateToken(user._id);
      return res.json({
        success: true,
        message: 'Logged in successfully',
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
          token,
          isNewUser: false
        }
      });
    }

    // If new user, return success and flag for registration
    res.json({
      success: true,
      message: 'Token verified. Please complete registration.',
      data: {
        isNewUser: true,
        phone
      }
    });
  } catch (error) {
    console.error('Firebase token verification error:', error);
    next(new AppError('Invalid or expired Firebase token', 401));
  }
};

/**
 * @desc    Register new user (Firebase verified)
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role, idToken } = req.body;

    // 1. Verify phone via Firebase if idToken is provided
    if (idToken) {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      if (decodedToken.phone_number !== phone) {
        return next(new AppError('Phone number mismatch with token', 400));
      }
    } else if (phone && process.env.NODE_ENV === 'production') {
      return next(new AppError('Firebase verification required for phone registration', 400));
    }

    // 2. Check if phone exists
    if (phone) {
      const phoneExists = await User.findOne({ phone });
      if (phoneExists) {
        return next(new AppError('Phone number already registered', 400));
      }
    }

    // 3. Check if email exists if provided
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
 * @desc    Login user (Support both Email/Password and Firebase)
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    const { email, password, idToken } = req.body;

    let user;

    // Option 1: Firebase ID Token Login (Phone)
    if (idToken) {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const phone = decodedToken.phone_number;

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
      return next(new AppError('Please provide email/password or Firebase token', 400));
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
