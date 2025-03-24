import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './ChargingList.css'; // Ensure CSS file is imported

const ChargingList = () => {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/charging');
        setRecords(response.data);
      } catch (error) {
        console.error('Error fetching charging records:', error);
      }
    };
    fetchRecords();
  }, []);

  return (
    <div className="charging-container">
      <h2>Charging Records</h2>
      <ul className="charging-list">
        {records.length > 0 ? (
          records.map((record) => (
            <li key={record._id}>
              {record.vehicleId} - {record.energyUsed} kWh - ₹{record.amountCharged}
            </li>
          ))
        ) : (
          <li className="no-records">No charging records available.</li>
        )}
      </ul>
    </div>
  );
};

export default ChargingList;
