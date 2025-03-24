import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const text = await response.text(); // Read response as text first
      console.log("Raw Response:", text); // Debugging - Check if it's HTML

      // Try parsing as JSON
      let data;
      try {
        data = JSON.parse(text);
      } catch (jsonError) {
        throw new Error('Server returned invalid JSON. Possible backend issue.');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setSuccess('✅ Registration successful! Redirecting...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(`❌ ${err.message}`);
    }
  };

  return (
    <div>
      <h2>Register</h2>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}

      <form onSubmit={handleSubmit}>
        <input 
          type="text" 
          placeholder="Name" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          required 
        />
        <input 
          type="email" 
          placeholder="Email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        <button type="submit">Register</button>
      </form>

      <p>Already have an account? <Link to="/login">Login</Link></p>
    </div>
  );
};

export default Register;
