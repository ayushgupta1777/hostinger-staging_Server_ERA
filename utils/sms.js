import axios from 'axios';

/**
 * Send OTP via MSG91
 * @param {string} phone - Target phone number
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const sendOTP_MSG91 = async (phone) => {
    try {
        if (!process.env.MSG91_AUTH_KEY || !process.env.MSG91_TEMPLATE_ID || !process.env.MSG91_SENDER_ID) {
            console.warn('MSG91 configuration variables missing from .env');
            return { success: false, message: 'MSG91 API keys missing in environment' };
        }

        // Clean phone number (MSG91 requires country code, remove symbols like +, -, spaces)
        const cleanPhone = String(phone).replace(/\D/g, '');
        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        // Force MSG91 to generate the OTP internally, specifying properties it expects
        const url = `https://control.msg91.com/api/v5/otp?template_id=${process.env.MSG91_TEMPLATE_ID}&mobile=${formattedPhone}&otp_length=4&otp_expiry=15&sender=${process.env.MSG91_SENDER_ID}`;

        // We pass an empty payload so MSG91 generates the OTP internally for its verification system
        const response = await axios.post(url, {}, {
            headers: {
                'authkey': process.env.MSG91_AUTH_KEY,
                'Content-Type': 'application/JSON'
            }
        });

        console.log('MSG91 Raw Post Response:', response.data);

        if (response.data && response.data.type === 'success') {
            return { success: true, message: 'OTP sent successfully' };
        } else {
            console.error('MSG91 Error Response:', response.data);
            return { success: false, message: response.data.message || 'Failed to send OTP' };
        }
    } catch (error) {
        console.error('Error sending SMS via MSG91:', error.response?.data || error.message);
        return { success: false, message: error.message };
    }
};

/**
 * Verify OTP via MSG91
 * @param {string} phone - Target phone number
 * @param {string} otp - OTP to verify
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const verifyOTP_MSG91 = async (phone, otp) => {
    try {
        if (!process.env.MSG91_AUTH_KEY) {
            return { success: false, message: 'MSG91 API keys missing in environment' };
        }

        const cleanPhone = String(phone).replace(/\D/g, '');
        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        const url = `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=${formattedPhone}`;

        const response = await axios.get(url, {
            headers: {
                'authkey': process.env.MSG91_AUTH_KEY,
            }
        });

        if (response.data && response.data.type === 'success') {
            return { success: true, message: 'OTP verified successfully' };
        } else {
            // MSG91 returns "error" type for wrong/expired OTP
            return { success: false, message: response.data.message || 'Invalid OTP' };
        }
    } catch (error) {
        console.error('Error verifying OTP via MSG91:', error.response?.data || error.message);
        return { success: false, message: error.response?.data?.message || error.message };
    }
};
