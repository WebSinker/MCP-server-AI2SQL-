require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testApiKey() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent("Hello, World!");
    console.log("API Key is valid!");
    console.log(result.response.text());
  } catch (error) {
    console.error("API Key validation failed:", error.message);
  }
}

testApiKey();