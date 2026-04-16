const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Camcine OTT Platform API',
      version: '1.0.0',
      description: 'REST API for Camcine OTT Platform — Auth & User Management built with Node.js, Express, and PostgreSQL',
      contact: {
        name: 'Camcine API Support',
        email: 'support@camcine.com',
      },
    },
    servers: [
      { url: 'http://localhost:3000/api/v1', description: 'Development Server' },
      { url: 'https://camcineapi-production.up.railway.app/api/v1', description: 'Production Server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            phone_number: { type: 'string' },
            role: { type: 'string', enum: ['viewer', 'actor', 'manager', 'admin'] },
            age: { type: 'integer' },
            language_preferences: { type: 'array', items: { type: 'string' } },
            regions: { type: 'array', items: { type: 'string' } },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            errors: { type: 'array', items: { type: 'object' } },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);