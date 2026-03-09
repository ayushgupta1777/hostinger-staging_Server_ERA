import axios from 'axios';

/**
 * Send OTP via 2Factor API
 * @param {string} phone - Target phone number (10 digits)
 * @param {string} otp - The OTP to send
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const sendOTP_2Factor = async (phone, otp) => {
    try {
        const apiKey = process.env.TWO_FACTOR_API_KEY;
        if (!apiKey || apiKey === 'YOUR_2FACTOR_API_KEY') {
            return { success: false, message: '2Factor API key is missing or not configured' };
        }

        // Clean phone number to 10 digits
        const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);

        // 2Factor API Format with Template: https://2factor.in/API/V1/{APIKEY}/SMS/{PHONE}/{OTP}/{TEMPLATE}
        const templateName = process.env.TWO_FACTOR_TEMPLATE_NAME;
        let url = `https://2factor.in/API/V1/${apiKey}/SMS/${cleanPhone}/${otp}`;

        if (templateName && templateName !== 'YOUR_TEMPLATE_NAME') {
            url += `/${templateName}`;
        }

        console.log(`[otpService] Sending 2Factor OTP to ${cleanPhone} with Template: ${templateName || 'DEFAULT'}`);
        const response = await axios.get(url);

        console.log('[otpService] 2Factor Detail Response:', JSON.stringify(response.data, null, 2));

        if (response.data && response.data.Status === 'Success') {
            return { success: true, message: 'OTP sent successfully via 2Factor' };
        } else {
            console.error('2Factor Error Response:', response.data);
            return { success: false, message: response.data.Details || 'Failed to send OTP via 2Factor' };
        }
    } catch (error) {
        console.error('Error sending SMS via 2Factor:', error.response?.data || error.message);
        return { success: false, message: error.message };
    }
};
