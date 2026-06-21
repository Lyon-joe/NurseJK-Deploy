// ==========================================
// API BASE URL SPECIFICATION FOR MOBILE DEPLOYMENT
// ==========================================

// Change this to true when you are testing locally on your computer
// Change this to false when building the app bundle for your mobile phone
const IS_LOCAL_TESTING = false; 

const API_BASE = IS_LOCAL_TESTING 
  ? "http://localhost:3001" 
  : "https://nursejk-assistant-q1oe.onrender.com";

export default API_BASE;