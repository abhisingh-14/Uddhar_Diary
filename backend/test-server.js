require('dotenv').config();
const app = require('./index');
const http = require('http');

const server = http.createServer(app);
server.listen(3002, async () => {
  console.log('Server started on 3002');
  try {
    const res = await fetch('http://localhost:3002/api/people?userId=999af4e5-6e7b-4512-9202-95c1a29dfff0');
    console.log('GET /api/people status:', res.status);
    const body = await res.text();
    console.log('GET /api/people body:', body);
  } catch (err) {
    console.error(err);
  } finally {
    server.close();
  }
});
