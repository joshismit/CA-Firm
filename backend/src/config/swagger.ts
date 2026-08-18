import swaggerJSDoc from 'swagger-jsdoc';
import { env } from './environment';

/**
 * OpenAPI / Swagger configuration.
 * Auto-generates docs from JSDoc comments in route files.
 */
const swaggerDefinition: swaggerJSDoc.OAS3Definition = {
  openapi: '3.0.0',
  info: {
    title: 'CA Firm ERP — API Documentation',
    version: '1.0.0',
    description:
      'Production-grade multi-tenant ERP for Chartered Accountant Firms in India.',
    contact: {
      name: 'API Support',
      email: 'support@cafirm.com',
    },
    license: {
      name: 'Proprietary',
      url: 'https://cafirm.com',
    },
  },
  servers: [
    {
      url: `${env.APP_URL}${env.API_PREFIX}`,
      description:
        env.NODE_ENV === 'production'
          ? 'Production Server'
          : 'Development Server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token obtained from /auth/login',
      },
    },
    schemas: {},
  },
  security: [{ BearerAuth: [] }],
  tags: [
    { name: 'Auth', description: 'Authentication & Authorization' },
    { name: 'Tenants', description: 'Tenant management' },
    { name: 'Users', description: 'User management' },
    { name: 'Clients', description: 'Client management' },
    { name: 'Documents', description: 'Document management' },
    { name: 'Tasks', description: 'Task management' },
    { name: 'Projects', description: 'Project (engagement) management' },
    { name: 'Reports', description: 'Reports & Analytics' },
    { name: 'Master Admin', description: 'Master admin operations' },
    { name: 'Health', description: 'Health & readiness checks' },
  ],
};

const options: swaggerJSDoc.Options = {
  swaggerDefinition,
  apis: ['./src/modules/**/routes/*.ts', './src/routes/*.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);
