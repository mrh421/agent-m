// smtp.mjs — logging in to the SMTP server and sending a draft's bytes (MOD-mail-protocols, Parts). A login is sent only over TLS
// (THE MAIL SERVER IS REACHED ONLY OVER TLS).
//
// Module: MOD-mail-protocols

import { STARTTLS, TLS, normaliseSecurity, mapMailFailure, tlsOptions } from "./imap.mjs";

function transportOf({ smtp, smtpAccount, password }, mailer) {
  const security = normaliseSecurity(smtp, "SMTP");
  return mailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: security === TLS,
    requireTLS: security === STARTTLS,
    auth: { user: smtpAccount, pass: password },
    logger: false,
    debug: false,
    tls: tlsOptions(smtp),
  });
}

// Logs in and disconnects without sending.
export async function testSmtp(connection, mailer) {
  const transport = transportOf(connection, mailer);
  try {
    await transport.verify();
  } catch (error) {
    mapMailFailure(error, "SMTP", connection.smtp);
  } finally {
    transport.close();
  }
}

// Sends exactly these bytes from the sender the connection names, else from the account, to these recipients.
export async function sendBytes(connection, mailer, bytes, recipients) {
  const transport = transportOf(connection, mailer);
  try {
    await transport.sendMail({ envelope: { from: connection.sender?.address ?? connection.account, to: recipients }, raw: bytes });
  } catch (error) {
    mapMailFailure(error, "SMTP", connection.smtp);
  } finally {
    transport.close();
  }
}
