const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8001";

/* ===== Core OTP sender ===== */
type SendOtpPayload = { email?: string; phone?: string };

async function sendOtpBase(payload: SendOtpPayload) {
  const res = await fetch(`${API_BASE}/auth/send-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to send OTP");
  }

  return res.json();
}

/* ===== Public APIs ===== */
export function sendOtpForSignup(payload: SendOtpPayload) {
  return sendOtpBase(payload);
}

export function sendOtpForLogin(payload: SendOtpPayload) {
  return sendOtpBase(payload);
}
