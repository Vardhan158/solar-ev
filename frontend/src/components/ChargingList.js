import React, { useEffect, useState } from 'react';
import axios from 'axios';

const ChargingList = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const response = await axios.get(
          'https://solar-ev-backend.onrender.com/api/charging-records',
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );
        setRecords(response.data);
      } catch (err) {
        console.error('❌ Error fetching records:', err);
        setError('⚠️ Failed to fetch charging records. Please check if the backend is running and the route exists.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, []);

  return (
    <div
      style={{
        padding: '20px',
        color: 'white',
        maxWidth: '800px',
        margin: '0 auto',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h2
        style={{
          textAlign: 'center',
          marginBottom: '20px',
          color: '#f97316',
        }}
      >
        ⚡ Charging Records
      </h2>

      {loading ? (
        <p style={{ textAlign: 'center' }}>🔄 Loading records...</p>
      ) : error ? (
        <div
          style={{
            color: '#f87171',
            backgroundColor: '#1e293b',
            padding: '10px',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      ) : records.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {records.map((record) => (
            <li
              key={record._id}
              style={{
                backgroundColor: '#1f2937',
                padding: '15px',
                marginBottom: '15px',
                borderRadius: '10px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              }}
            >
              <p><strong>🚗 Vehicle ID:</strong> {record.vehicleId}</p>
              <p><strong>⚡ Energy Used:</strong> {record.energyUsed} kWh</p>
              <p><strong>💰 Amount Charged:</strong> ₹{record.amountCharged}</p>
              <p><strong>🕓 Start Time:</strong> {new Date(record.startTime).toLocaleString()}</p>
              <p><strong>🕔 End Time:</strong> {new Date(record.endTime).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ textAlign: 'center' }}>📭 No charging records available.</p>
      )}
    </div>
  );
};

export default ChargingList;
