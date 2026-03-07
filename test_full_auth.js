import axios from 'axios';

const phone = '9876543210';

const testFullFlow = async () => {
    try {
        // 1. Request OTP
        console.log('Sending OTP...');
        const sendResponse = await axios.post('http://localhost:5000/api/auth/send-otp', {
            phone,
            type: 'signup'
        });
        const otp = sendResponse.data.otp;
        console.log('Got OTP:', otp);

        // 2. Verify OTP
        console.log('Verifying OTP...');
        const verifyResponse = await axios.post('http://localhost:5000/api/auth/verify-otp', {
            phone,
            otp
        });
        console.log('Verify Response:', JSON.stringify(verifyResponse.data, null, 2));

        // 3. Register
        console.log('Registering...');
        const registerResponse = await axios.post('http://localhost:5000/api/auth/register', {
            name: 'Test User',
            email: `test_${Date.now()}@example.com`,
            password: 'password123',
            phone,
            role: 'customer'
        });
        console.log('Register Response:', JSON.stringify(registerResponse.data, null, 2));

    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
};

testFullFlow();
