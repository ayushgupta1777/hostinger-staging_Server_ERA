import axios from 'axios';

/**
 * Send SMS using Fast2SMS API
 * @param {string} phone - Recipient phone number
 * @param {string} message - Message content
 */
export const sendSMS = async (phone, message) => {
    try {
        const apiKey = process.env.FAST2SMS;

        if (!apiKey) {
            console.warn('FAST2SMS API key not found in environment variables');
            return { success: false, message: 'SMS service not configured' };
        }

        // Fast2SMS Quick Send API
        const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
            params: {
                authorization: apiKey,
                route: 'otp',
                variables_values: message,
                numbers: phone,
            },
            headers: {
                'cache-control': 'no-cache',
            }
        });

        return {
            success: response.data.return,
            message: response.data.message[0] || 'SMS sent successfully'
        };
    } catch (error) {
        console.error('Fast2SMS Error:', error.response?.data || error.message);
        return {
            success: false,
            message: error.response?.data?.message || 'Failed to send SMS'
        };
    }
};

/**
 * Send OTP specifically
 * @param {string} phone - Recipient phone number
 * @param {string} otp - 6-digit OTP
 */
export const sendOTP_SMS = async (phone, otp) => {
    // For 'otp' route in Fast2SMS, variables_values should contain the OTP
    return await sendSMS(phone, otp);
};
