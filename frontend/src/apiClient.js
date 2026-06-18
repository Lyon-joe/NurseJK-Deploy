import API_BASE from "./api";

// 🔐 GET TOKEN
function getToken() {
  return localStorage.getItem("token");
}

// 📌 LOGIN
export async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  return res.json();
}

// 📌 REGISTER
export async function register(name, email, password) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name, email, password })
  });

  return res.json();
}

// 💬 CHAT (PROTECTED)
export async function sendMessage(message) {
  const token = getToken();

  const res = await fetch(`${API_BASE}/api/chat/retrieval`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ message })
  });

  return res.json();
}