const axios = require('axios');
const crypto = require('crypto');

// Fetch Paymob authentication token
const getAuthToken = async () => {
    const data = {
        api_key: process.env.PAY_API,
        username: process.env.USERNAME,
        password: process.env.PASSWORD,
    };
    try {
        const response = await axios.post('https://accept.paymob.com/api/auth/tokens', data,{ api_key: process.env.PAY_API, });
        if (response.data.token) {
        return response.data.token;
        } else {
        throw new Error('Failed to fetch authentication token');
        }
    } catch (err) {
        console.error('Error fetching auth token:', err.message);
        throw new Error('Internal server error');
    } 
};
const orderedKeys = [
  'obj.amount_cents', 
  'obj.created_at', 
  'obj.currency', 
  'obj.error_occured',  
  'obj.has_parent_transaction', 
  'obj.id', 
  'obj.integration_id', 
  'obj.is_3d_secure', 
  'obj.is_auth',       
  'obj.is_capture',    
  'obj.is_refunded',   
  'obj.is_standalone_payment', 
  'obj.is_voided',    
  'obj.order.id', 
  'obj.owner', 
  'obj.pending',       
  'obj.source_data.pan', 
  'obj.source_data.sub_type', 
  'obj.source_data.type', 
  'obj.success'
];

const verifyHmac = (receivedHmac, data) => {
  // Log the entire data object to check its structure
  console.log("Full Data Object:", JSON.stringify(data, null, 2));

  // Define the HMAC secret from your environment
  const hmacSecret = process.env.HMAC_KEY;

  // Check if 'obj' exists and is not null
  if (!data || !data.obj) {
      console.error("Error: 'obj' not found in data.");
      return false;
  }

  // Define the values array to store extracted values
  const values = orderedKeys.map((key) => {
      const keys = key.split('.'); // Split keys for nested fields
      let value = data;
      
      // Navigate the object using the keys
      for (const k of keys) {
          if (value && value[k] !== undefined) {
              value = value[k]; // Update value if the key exists
          } else {
              console.warn(`Key "${key}" not found in data, setting to empty string.`);
              value = ''; // Set to empty string if the key does not exist
              break;
          }
      }

      // Log each value being extracted
      console.log(`Extracted Value for "${key}":`, value);

      // Check for boolean values and convert them to strings "true" or "false"
      if (typeof value === 'boolean') {
          value = value.toString(); // Convert to "true" or "false"
      }
      
      // Ensure all values are strings and trim extra spaces
      return value ? value.toString().trim() : ''; 
  });

  // Concatenate all values into a single string
  const concatenatedData = values.join(''); 

  console.log("Concatenated Data:", concatenatedData);

  // Generate the HMAC using the concatenated string
  const hmac = crypto.createHmac('sha512', hmacSecret)
      .update(concatenatedData, 'utf8') // Ensure UTF-8 encoding
      .digest('hex') // Convert to hexadecimal
      .toLowerCase(); // Convert to lowercase

  console.log("Generated HMAC:", hmac);

  // Compare the generated HMAC with the received HMAC
  return hmac === receivedHmac.toLowerCase();
};

module.exports = { getAuthToken, verifyHmac };