# Verification Checklist

This checklist should be used to verify the application after the recent changes have been deployed.

## Session Management

- [ ] Verify that the `sessions` table has been created in the PostgreSQL database.
- [ ] Log in to the application and verify that a new session is created in the `sessions` table.
- [ ] Log out of the application and verify that the session is destroyed.
- [ ] Verify that the session persists after restarting the server.

## Email

- [ ] Trigger a password reset and verify that an email is sent.
- [ ] Check the email logs to ensure that there are no timeout errors.

## PM2

- [ ] Check the status of the application using `pm2 list` and verify that it is running.
- [ ] Monitor the application for a while and verify that the number of restarts is not increasing abnormally.
- [ ] Check the error logs (`~/.pm2/logs/editaliza-error.log`) and verify that there are no new errors.

## General

- [ ] Perform a general smoke test of the application to ensure that all features are working as expected.
- [ ] Check the browser's developer console for any new errors.