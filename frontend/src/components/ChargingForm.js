import React, { useState } from 'react';
import axios from 'axios';
import BillingComponent from './BillingComponent'; // Import the billing component

const ChargingForm = () => {
  const [form, setForm] = useState({
    vehicleId: '',
    startTime: '',
    endTime: '',
    energyUsed: '',
    amountCharged: '',
  });

  const [billDetails, setBillDetails] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/charging', form);
      alert('Record added successfully!');

      // Set bill details to display the BillingComponent
      setBillDetails({
        vehicleId: form.vehicleId,
        energyUsed: form.energyUsed,
        amountCharged: form.amountCharged,
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input type="text" name="vehicleId" placeholder="Vehicle ID" onChange={handleChange} required />
        <input type="datetime-local" name="startTime" onChange={handleChange} required />
        <input type="datetime-local" name="endTime" onChange={handleChange} required />
        <input type="number" name="energyUsed" placeholder="Energy Used (kWh)" onChange={handleChange} required />
        <input type="number" name="amountCharged" placeholder="Amount Charged" onChange={handleChange} required />
        <button type="submit">Add Record</button>
      </form>

      {/* Show Bill when form is submitted */}
      {billDetails && <BillingComponent {...billDetails} />}
    </div>
  );
};

export default ChargingForm;
