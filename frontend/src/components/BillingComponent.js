import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';

const BillingComponent = ({ vehicleId, energyUsed, amountCharged }) => {
  const billRef = useRef();

  const upiId = "9964461359@axl";
  const upiName = "Harshavardhan";
  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${amountCharged}&cu=INR`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Container className="mt-4">
      <Row className="justify-content-center">
        <Col md={6}>
          <Card className="shadow p-4">
            <Card.Body ref={billRef}>
              <h2 className="text-center">Billing Receipt</h2>
              <hr />
              <p><strong>Vehicle ID:</strong> {vehicleId}</p>
              <p><strong>Energy Used:</strong> {energyUsed} kWh</p>
              <p><strong>Amount Charged:</strong> ₹{amountCharged}</p>
            </Card.Body>
          </Card>

          {/* QR Code - Hidden in Print Mode */}
          <div className="text-center mt-3 qr-code-container">
            <h4>Scan to Pay</h4>
            <QRCodeCanvas value={upiLink} size={180} />
          </div>

          {/* Print Button - Hidden in Print Mode */}
          <div className="text-center mt-3">
            <Button variant="primary" onClick={handlePrint} className="print-btn">Print Bill</Button>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default BillingComponent;
