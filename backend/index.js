require('dotenv').config();

const express = require('express');
const cors = require('cors');
const billsRouter = require('./src/routes/bills');
const peopleRouter = require('./src/routes/people');
const categoriesRouter = require('./src/routes/categories');
const debtsRouter = require('./src/routes/debts');
const expensesRouter = require('./src/routes/expenses');
const profileRouter = require('./src/routes/profile');
const accountRouter = require('./src/routes/account');

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
app.use('/api/debts', debtsRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/profile', profileRouter);
app.use('/api/account', accountRouter);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;