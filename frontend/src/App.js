import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, Link } from 'react-router-dom';
import ChargingForm from './components/ChargingForm';
import ChargingList from './components/ChargingList';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/reset-password'; // ✅ Import Reset Password Component
import './App.css';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('isAuthenticated') === 'true'
  );

  useEffect(() => {
    localStorage.setItem('isAuthenticated', isAuthenticated);
  }, [isAuthenticated]);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register onRegister={handleLogin} />} />
        <Route path="/dashboard" element={isAuthenticated ? <Dashboard onLogout={handleLogout} /> : <Navigate to="/login" />} />
        <Route path="/charging-form" element={isAuthenticated ? <ChargingForm /> : <Navigate to="/login" />} />
        <Route path="/charging-list" element={isAuthenticated ? <ChargingList /> : <Navigate to="/login" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} /> {/* ✅ Added Reset Password Route */}
      </Routes>
    </Router>
  );
};

const Dashboard = ({ onLogout }) => {
  return (
    <div>
      <h1 className='solar-ev'>Solar EV Charging Dashboard</h1>
      <nav>
        <ul>
          <li><Link to="/charging-form">Charging Form</Link></li>
          <li><Link to="/charging-list">Charging List</Link></li>
          <li><button onClick={onLogout}>Logout</button></li>
        </ul>
      </nav>
    </div>
  );
};

export default App;
