// Example debug wrapper — paste into frontend where you call send-otp
async function sendOtp(email: string) {
  try {
    const res = await fetch("http://127.0.0.1:8000/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }), // <- ensure this matches backend model
    });

    // try JSON, fallback to text to see full error
    const body = await res.json().catch(async () => await res.text());

    if (!res.ok) {
      console.error("send-otp failed", res.status, body);
      return { ok: false, status: res.status, body };
    }

    console.log("send-otp success", body);
    return { ok: true, body };
  } catch (err) {
    console.error("send-otp network/error", err);
    return { ok: false, error: err };
  }
}