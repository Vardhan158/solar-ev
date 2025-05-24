import React, { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Container, Row, Col, Button, Card, Spinner } from 'react-bootstrap';
import axios from 'axios';

const BillingComponent = ({ vehicleId, energyUsed, amountCharged }) => {
  const billRef = useRef();
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handlePrint = () => {
    if (!billRef.current) return;
    const printContents = billRef.current.innerHTML;
    const originalContents = document.body.innerHTML;

    document.body.innerHTML = printContents;
    window.print();

    // Restore after printing
    document.body.innerHTML = originalContents;
    window.location.reload();
  };

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleRazorpayPayment = async () => {
    setLoadingPayment(true);

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const razorpayKey = process.env.REACT_APP_RAZORPAY_KEY_ID;

      if (!apiUrl || !razorpayKey) {
        alert('❌ Missing API URL or Razorpay Key in .env');
        setLoadingPayment(false);
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded) {
        alert('❌ Failed to load Razorpay SDK');
        setLoadingPayment(false);
        return;
      }

      const amountInPaise = Math.round(Number(amountCharged) * 100);
      const { data } = await axios.post(`${apiUrl}/api/create-order`, {
        amount: amountInPaise,
        vehicleId,
      });

      const { order } = data;
      if (!order?.id) {
        alert('❌ Failed to create Razorpay order');
        setLoadingPayment(false);
        return;
      }

      const options = {
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        name: 'EV Charging Station',
        description: 'Charging Bill Payment',
        order_id: order.id,
        handler: async function (response) {
          try {
            const verifyRes = await axios.post(`${apiUrl}/api/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              vehicleId,
            });

            if (verifyRes.data.success) {
              alert('✅ Payment Successful!');
              setPaymentSuccess(true); // ✅ Allow print button
            } else {
              alert('❌ Payment verification failed.');
            }
          } catch (err) {
            console.error('Verification Error:', err);
            alert('❌ Error verifying payment.');
          } finally {
            setLoadingPayment(false);
          }
        },
        prefill: {
          name: 'Customer',
          email: 'customer@example.com',
          contact: '9999999999',
        },
        notes: {
          vehicleId,
        },
        theme: {
          color: '#0d6efd',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error('Razorpay Error:', error);
      alert('❌ Payment failed. Try again.');
      setLoadingPayment(false);
    }
  };

  return (
    <Container className="mt-4">
      <Row className="justify-content-center">
        <Col md={6}>
          <Card className="shadow p-4">
            <Card.Body ref={billRef}>
              <h2 className="text-center mb-3">Billing Receipt</h2>
              <hr />
              <p><strong>Vehicle ID:</strong> {vehicleId}</p>
              <p><strong>Energy Used:</strong> {energyUsed} kWh</p>
              <p><strong>Amount Charged:</strong> ₹{amountCharged}</p>
            </Card.Body>
          </Card>

          {/* QR Code (Optional UPI alternative) */}
          {amountCharged && (
            <div className="text-center mt-3 d-print-none">
              <h5>Scan to Pay (UPI)</h5>
              <QRCodeCanvas
                value={`upi://pay?pa=9964461359@axl&pn=Harshavardhan&am=${amountCharged}&cu=INR`}
                size={180}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="text-center mt-3 d-print-none">
            {!paymentSuccess && (
              <Button
                variant="success"
                onClick={handleRazorpayPayment}
                disabled={loadingPayment}
                className="me-2"
              >
                {loadingPayment ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                    />{' '}
                    Processing...
                  </>
                ) : (
                  'Pay with Razorpay'
                )}
              </Button>
            )}

            {paymentSuccess && (
              <Button variant="secondary" onClick={handlePrint}>
                Print Bill
              </Button>
            )}
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default BillingComponent;
