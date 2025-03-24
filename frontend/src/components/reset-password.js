import { useState, useEffect } from "react";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const { token: paramToken } = useParams();
  const navigate = useNavigate();

  // Get token from either ?token=abc123 or /reset-password/abc123
  const token = searchParams.get("token") || paramToken;

  useEffect(() => {
    console.log("Extracted Token:", token); // Debugging log
  }, [token]);

  const handleReset = async (event) => {
    event.preventDefault();

    if (!password || !confirmPassword) {
      setMessage("⚠️ Please fill in both fields.");
      return;
    }
    if (password.length < 6) {
      setMessage("⚠️ Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("⚠️ Passwords do not match!");
      return;
    }
    if (!token) {
      setMessage("⚠️ Reset token is missing. Try again.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`https://solar-ev-backend.onrender.com/api/reset-password/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();
      console.log("Server Response:", data);

      if (response.ok) {
        setMessage("✅ Password reset successful! Redirecting to login...");
        setTimeout(() => navigate("/login"), 3000);
      } else {
        setMessage(data.error || "❌ Error resetting password.");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setMessage("❌ Server error. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-6 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-semibold text-center mb-4">Reset Password</h2>

        {message && (
          <p className={`text-sm text-center ${message.startsWith("✅") ? "text-green-500" : "text-red-500"}`}>
            {message}
          </p>
        )}

        <form onSubmit={handleReset} className="mt-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">New Password</label>
            <input
              type="password"
              className="w-full p-2 border rounded-md"
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
            <input
              type="password"
              className="w-full p-2 border rounded-md"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition disabled:bg-gray-400"
            disabled={loading}
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
