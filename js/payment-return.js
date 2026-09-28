document.addEventListener("DOMContentLoaded", async () => {
  const title = document.getElementById("payment-title");
  const message = document.getElementById("payment-message");
  const link = document.getElementById("payment-link");
  const parameters = new URLSearchParams(window.location.search);
  const reference = parameters.get("reference") || parameters.get("trxref");
  const appointmentId = parameters.get("appointmentId");
  const token = localStorage.getItem("glamoraToken");

  if (!reference || !appointmentId || !token) {
    title.textContent = "Payment could not be confirmed";
    message.textContent = "The payment return is missing its appointment, reference, or signed-in session. Your appointment remains pending payment.";
    link.hidden = false;
    return;
  }

  try {
    const response = await fetch(`http://localhost:3000/api/payments/appointments/${appointmentId}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reference }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Paystack payment verification failed.");

    title.textContent = "Appointment confirmed";
    message.textContent = "Your upfront deposit, VAT, and applicable logistics payment have been verified.";
    link.hidden = false;
  } catch (error) {
    title.textContent = "Payment is still pending";
    message.textContent = `${error.message} Your appointment will remain pending until payment is verified.`;
    link.hidden = false;
  }
});