require('dotenv').config();

const express = require('express');
const cors = require('cors');
const billsRouter = require('./src/routes/bills');
const peopleRouter = require('./src/routes/people');
const categoriesRouter = require('./src/routes/categories');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/bills', billsRouter);
app.use('/api/people', peopleRouter);
app.use('/api/categories', categoriesRouter);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;