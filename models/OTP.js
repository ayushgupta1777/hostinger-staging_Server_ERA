import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        index: true
    },
    otp: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['signup', 'login', 'verification'],
        default: 'verification'
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 } // Document will be deleted at this time
    },
    verified: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const OTP = mongoose.model('OTP', otpSchema);

export default OTP;
