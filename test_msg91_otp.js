import axios from 'axios';

const testPhone = '0000000000'; // Replace during execution if necessary

async function run() {
    try {
        console.log(`Sending MSG91 OTP request to ${testPhone}...`);
        const res = await axios.post('http://localhost:5000/api/auth/send-otp', {
            phone: testPhone,
            type: 'login'
        });
        console.log('Result:', res.data);
    } catch (e) {
        console.error('Error:', e.response?.data || e.message);
    }
}

run();
