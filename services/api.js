const axios = require('axios');
require('dotenv').config();

const api = axios.create({
  baseURL: process.env.API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

module.exports = api;
