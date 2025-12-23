// Import axios library for making HTTP requests
const axios = require('axios');

// OpenAI GPT-3.5 API integration
const openAIApiKey = process.env.OPENAI_API_KEY; // Make sure to set your API key in environment variables
const apiUrl = 'https://api.openai.com/v1/chat/completions';

/**
 * Function to fetch GPT-3.5 response based on user message
 * @param {String} userMessage - The message input from the user
 * @returns {Promise<String>} - GPT-3.5 generated response
 */
const getGPT35Response = async (userMessage) => {
    try {
        const response = await axios.post(
            apiUrl,
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: userMessage }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openAIApiKey}`
                }
            }
        );

        // Extract the generated message content
        const gptResponse = response.data.choices[0].message.content;
        return gptResponse;
    } catch (error) {
        console.error('Error while fetching GPT-3.5 response:', error);
        throw new Error('Failed to get response from GPT-3.5 API');
    }
};

module.exports = {
    getGPT35Response,
};