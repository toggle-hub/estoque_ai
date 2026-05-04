# Agents.md - Estoquei MVP Architecture Decisions

## Project Overview
Estoquei is an inventory management SaaS for Brazilian businesses. Built with Hono, AWS Lambda, SQS, PostgreSQL, and React.

## Technology Stack

Backend:
- Hono framework (lightweight, fast, serverless-optimized)
- TypeScript 5+
- REST API with OpenAPI documentation
- Deployed on AWS Lambda

Database:
- PostgreSQL 15+ (AWS RDS or Aurora Serverless)
- AWS Lambda compatible connection pool (RDS Proxy)
- UUID for primary keys

Queue System:
- AWS SQS (Simple Queue Service)
- No Redis required (native AWS)
- Used for async processing: transactions, notifications, reports, bulk operations

Infrastructure:
- AWS Lambda for compute
- API Gateway for HTTP endpoints
- SQS for queue management
- CloudWatch for monitoring and logging
- RDS Proxy for database connection pooling

## Core Architecture Decisions

1. Multi-tenancy
Use database row-level isolation with organization_id on every table. Simpler than schema-per-tenant for MVP. All queries must filter by organization_id.

## Code Documentation

All functions must be documented with JSDoc. Use `@param` tags for helpers and other non-obvious functions, but do not add `@param` for route handlers. Add `@returns` when the return value is not obvious or is part of the function contract.

## Frontend Component Workflow

Every new React component must include a Storybook story in `apps/web/stories`. Update an existing story when changing component variants, props, or important visual states.

2. Authentication
JWT with refresh tokens. Store tokens in database or Lambda@Edge for validation. Three roles: Admin (full access), Manager (can edit), Viewer (read-only).

3. Serverless First Design
All endpoints are Lambda functions. Cold start optimization: keep functions warm with scheduled invocations. Use Lambda layers for dependencies. Keep deployment package under 50MB.

4. Transaction Audit Trail
Transactions table is append-only. Never update or delete transactions. Stock adjustments create new transaction records. Required for Brazilian compliance.

5. Queue Strategy with SQS
Use SQS Standard Queues for all async operations. Dead Letter Queue for failed messages. Visibility timeout set to 30 seconds. Maximum receive count of 3 before sending to DLQ.

SQS Queues to create:
- transactions-queue (process stock movements)
- alerts-queue (check and create alerts)
- notifications-queue (send emails)
- reports-queue (generate reports)
- bulk-operations-queue (CSV import/export)

Lambda triggers on each queue for processing.

6. ID Strategy
Use UUID v4 for all primary keys. No sequential IDs for security. Works well with distributed Lambda architecture.

7. Soft Delete
Use is_active flag for users, items, locations. Never delete transactions or usage metrics. Keep historical data for compliance.

8. Brazilian Requirements
Store currency as DECIMAL(10,2) for BRL. Store all timestamps as TIMESTAMPTZ in UTC. Keep transaction history for minimum 5 years for fiscal compliance.

9. Rate Limiting
Implement at API Gateway level using Usage Plans. Per-organization limits: 1000 requests per minute. Transaction limits based on plan (500 to 5000 per month).

10. Database Connection Management
Use RDS Proxy to manage connection pooling. Lambda functions cannot maintain persistent database connections. Set max connections per Lambda instance to 1.

## AWS Lambda Configuration

Function Settings:
- Memory: 1024 MB (adjust based on performance)
- Timeout: 30 seconds for API endpoints, 5 minutes for queue processors
- Runtime: Node.js 20.x
- Ephemeral storage: 512 MB (increase to 2048 MB for bulk operations)

Function Organization:
- api-handler (all HTTP endpoints routed by Hono)
- transaction-processor (SQS trigger)
- alert-processor (SQS trigger)
- notification-processor (SQS trigger)
- report-generator (SQS trigger)
- bulk-import-processor (SQS trigger)

## Database Tables (9 tables)

organizations - Multi-tenant companies with CNPJ
users - User accounts with roles and CPF
locations - Warehouses and stores
categories - Product groups
items - Products with SKU, price, reorder point
stock_levels - Current quantity per location
transactions - Immutable stock movement log
alerts - Low stock notifications
usage_metrics - Monthly transaction counts for billing

## API Routes (77 total routes)

Phase 1 - Must Have (20 routes):
- 4 auth routes: register, login, me, logout
- 3 org routes: list, create, get one
- 3 location routes: list, create, get one
- 3 category routes: list, create, get one
- 4 item routes: list, create, get one, update
- 4 stock routes: list all, by location, low stock, summary
- 1 transaction route: create receiving

Phase 2 - Core Inventory (15 additional routes):
- 3 transaction routes: sale, adjustment, list
- 3 alert routes: list, mark read, unread count
- 3 user routes: list, invite, update
- 3 dashboard routes: metrics, activity, alerts
- 2 report routes: stock value, movements
- 1 transfer route: between locations

Phase 3 - Advanced (remaining routes):
- Complete CRUD operations
- Bulk operations
- Report exports
- Webhooks
- Organization settings

## SQS Message Structure

Standard message format:
{
  messageId: "uuid",
  type: "TRANSACTION_CREATED",
  payload: {
    organizationId: "uuid",
    transactionId: "uuid",
    timestamp: "2024-01-01T00:00:00Z"
  },
  retryCount: 0
}

Queue Configuration:
- Visibility timeout: 30 seconds
- Message retention: 14 days
- Delivery delay: 0 seconds (default)
- Maximum message size: 256 KB
- Receive message wait time: 20 seconds (long polling)

Dead Letter Queue:
- Same configuration as main queue
- Maximum receives: 3
- Alert on DLQ messages via CloudWatch

## Performance Requirements

API Response Times:
- Simple queries (GET items, stock): < 200ms
- Complex queries (reports): < 2 seconds
- Cold starts: < 1 second (keep warm)

Database:
- All queries under 100ms
- Use RDS Proxy to prevent connection exhaustion
- Max 10 Lambda functions running database queries simultaneously per RDS Proxy instance

SQS Processing:
- Messages processed within 5 seconds of visibility timeout
- Batch size: 10 messages per Lambda invocation
- Maximum concurrency: 100 Lambda instances per queue

## Security Requirements

Authentication:
- Passwords hashed with bcrypt (cost factor 10)
- JWT validation at API Gateway or Lambda
- No sessions (stateless Lambda)

Route input validation:
- Validate path parameters used in UUID database columns before calling repositories or queries. Return a 400 client error for malformed UUIDs instead of passing invalid IDs to PostgreSQL.

Authorization:
- Validate organization_id from JWT on every request
- Role-based access control in Lambda
- Admin only for user management

AWS Security:
- Lambda in VPC with RDS
- Least privilege IAM roles
- Secrets Manager for database credentials
- SQS encryption at rest (SSE-S3)
- API Gateway with API keys for rate limiting

## Monitoring and Logging

CloudWatch:
- Lambda function logs (automatically captured)
- Custom metrics: transaction count, processing time, error rate
- SQS queue metrics: age, visible messages, dead letter count
- Alarms: DLQ not empty, Lambda errors > 5%, queue depth > 1000

Logging:
- Structured JSON logs
- Include requestId, organizationId, userId
- Log levels: ERROR, WARN, INFO, DEBUG
- No PII in logs

Health Checks:
- GET /health - Lambda returns 200
- Check RDS connection pool health
- Check SQS queue accessibility

## Cold Start Mitigation

Strategies:
- Keep Lambda functions warm with scheduled CloudWatch events (every 5 minutes)
- Use Lambda provisioned concurrency for critical functions (api-handler only)
- Minimize dependencies (Hono is lightweight)
- Use AWS SDK v3 (modular imports)
- Enable Lambda SnapStart for Java (not applicable for Node.js)

Warm functions to keep:
- api-handler: 5 provisioned concurrency
- transaction-processor: 2 provisioned concurrency

## Cost Optimization

Lambda Pricing (us-east-1 reference):
- Requests: $0.20 per 1 million requests
- Compute: $0.0000166667 per GB-second
- Estimate: 10 million requests/month = $2 for requests + $50-100 for compute

SQS Pricing:
- $0.40 per 1 million requests
- First 1 million requests free per month

RDS Proxy:
- $0.015 per hour ($11/month)
- Required for Lambda to RDS connections

Total estimated monthly cost for MVP:
- Lambda: $100
- SQS: $5
- RDS (db.t3.micro): $15
- RDS Proxy: $11
- API Gateway: $5
- Total: ~$136/month

## Development Workflow

Local Development:
- Use AWS SAM CLI for local Lambda testing
- Docker Compose for PostgreSQL locally
- LocalStack for SQS emulation
- Hono serve for API testing

Deployment:
- GitHub Actions for CI/CD
- sam deploy for Lambda updates
- Database migrations via Lambda function or CLI
- Blue-green deployment with API Gateway stages

Environment Variables:
DATABASE_URL (via Secrets Manager)
QUEUE_URL_TRANSACTIONS
QUEUE_URL_ALERTS
QUEUE_URL_NOTIFICATIONS
JWT_SECRET (via Secrets Manager)
NODE_ENV
AWS_REGION

## Future Considerations

Phase 2 Enhancements:
- WebSocket connections (API Gateway WebSocket)
- Step Functions for complex workflows
- EventBridge for scheduled jobs
- CloudFront CDN for static assets

Scaling Limits:
- Lambda concurrent executions: 1000 (default, can increase)
- SQS queue depth: unlimited
- RDS connections via RDS Proxy: 1000 (default)

## MVP Feature Checklist

Must Have (Launch):
- Authentication (register, login, JWT)
- Organization multi-tenancy
- Location management
- Product catalog (items, categories)
- Stock tracking (receive, sell, adjust)
- Transaction history
- Low stock alerts
- Basic dashboard
- Role-based access

Nice to Have (Post-launch):
- CSV import/export
- Transfer between locations
- Email notifications via SQS
- Report generation
- User invitation system

Out of Scope (Future):
- Barcode scanning
- Mobile app
- LLM/AI features
- Purchase orders
- Supplier management

Last Updated: 2024-01-15
Version: 1.0.0 (MVP - Serverless Edition)
