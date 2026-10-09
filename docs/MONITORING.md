# RestroSathi Monitoring

## In-App Alerts
RestroSathi evaluates its internal health periodically and sends WhatsApp alerts to the owner's phone.
The following conditions are monitored:
- **DB**: Database connectivity.
- **Disk**: The `uploads/` directory volume exceeding 85% utilization.
- **Backup**: More than 26 hours since the last successful off-site backup.
- **Outbox**: Any WhatsApp messages stuck in `PENDING` for >30m, or any `FAILED` messages in the last 60m.
- **WhatsApp**: Disconnected session lasting >30m.
- **AI**: Usage exceeding 80% of the monthly quota (or completely exhausted).
- **Errors**: 20 or more unhandled application errors in the last 10 minutes.

If an alert triggers, an alert will be sent. The system will repeat the alert every 6 hours until the condition resolves, at which point a recovery message is sent.

## External Uptime Monitoring
**In-app alerts cannot report a stopped or unreachable VPS.** If the server loses power, network connectivity, or the Docker daemon crashes entirely, the internal cron jobs will not run, meaning *no WhatsApp alerts will be sent*.

To ensure you are notified of total outages, you **must** configure an external uptime monitor (e.g., UptimeRobot, BetterStack, or Pingdom).

### Configuration
Point your external monitor to the public health endpoint:
```
GET https://<your-domain>/api/health
```

- **Expected Response**: `HTTP 200 OK`
- **Failure Condition**: Any `5xx` error or connection timeout indicates the app or VPS is down.

For comprehensive internal details, an authenticated deep-health endpoint is available at `/api/health/deep` requiring the `CRON_SECRET` as a Bearer token.
