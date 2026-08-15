require('dotenv').config();

const express = require('express');
const cors = require('cors');
const billsRouter = require('./src/routes/bills');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/bills', billsRouter);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;