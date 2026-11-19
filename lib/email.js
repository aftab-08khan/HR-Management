import {Resend} from 'resend';

let resendClient;
function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  resendClient ||= new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

export function isEmailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Send a welcome email with login credentials to a new workspace member.
 */
export async function sendWelcomeEmail({recipientEmail, recipientName, password, workspaceName, workspaceId, loginUrl}) {
  const resend = getResend();
  if (!resend) throw new Error('Email service is not configured. Set RESEND_API_KEY in your environment.');
  const fromAddress = process.env.EMAIL_FROM || 'PeopleOS <onboarding@resend.dev>';
  const appUrl = loginUrl || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const displayName = recipientName || recipientEmail;
  const html = welcomeEmailHtml({displayName, recipientEmail, password, workspaceName, workspaceId, appUrl});
  const {data, error} = await resend.emails.send({
    from: fromAddress,
    to: [recipientEmail],
    subject: `Welcome to ${workspaceName} — Your PeopleOS Login`,
    html,
  });
  if (error) throw new Error(error.message || 'Failed to send welcome email');
  return {ok: true, emailId: data?.id};
}

/**
 * Send a password-changed confirmation email.
 */
export async function sendPasswordChangedEmail({recipientEmail, recipientName, workspaceName}) {
  const resend = getResend();
  if (!resend) return {ok: true, skipped: true};
  const fromAddress = process.env.EMAIL_FROM || 'PeopleOS <onboarding@resend.dev>';
  const displayName = recipientName || recipientEmail;
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const html = passwordChangedHtml({displayName, appUrl, workspaceName});
  const {error} = await resend.emails.send({
    from: fromAddress,
    to: [recipientEmail],
    subject: `Password Updated — ${workspaceName}`,
    html,
  });
  if (error) console.error('Password-change confirmation email failed:', error.message);
  return {ok: true};
}

/** Send a short lived password reset link. */
export async function sendPasswordResetEmail({recipientEmail, recipientName, workspaceName, resetUrl}) {
  const resend = getResend();
  if (!resend) throw new Error('Email service is not configured. Set RESEND_API_KEY in your environment.');
  const fromAddress = process.env.EMAIL_FROM || 'PeopleOS <onboarding@resend.dev>';
  const displayName = recipientName || recipientEmail;
  const {error} = await resend.emails.send({
    from: fromAddress,
    to: [recipientEmail],
    subject: `Reset your PeopleOS password — ${workspaceName || 'Your workspace'}`,
    html: passwordResetHtml({displayName, workspaceName, resetUrl}),
  });
  if (error) throw new Error(error.message || 'Failed to send password reset email');
  return {ok: true};
}

/** Generate a cryptographically random temporary password. */
export function generateTempPassword(length = 16) {
  const {randomBytes} = require('node:crypto');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$!&';
  const bytes = randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) password += chars[bytes[i] % chars.length];
  return password;
}

function welcomeEmailHtml({displayName, recipientEmail, password, workspaceName, workspaceId, appUrl}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to ${esc(workspaceName)}</title></head>
<body style="margin:0;padding:0;background:#0f0f14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#e4e4e7;">
<div style="max-width:560px;margin:0 auto;padding:40px 20px;">
  <div style="background:linear-gradient(135deg,#18181f 0%,#1e1e2a 100%);border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a855f7 100%);padding:36px 32px;text-align:center;">
      <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 12px;margin-bottom:16px;">
        <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">people<span style="opacity:0.85">os</span></span>
      </div>
      <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 6px;letter-spacing:-0.3px;">Welcome aboard! 🎉</h1>
      <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:0;">Your workspace is ready and waiting.</p>
    </div>
    <!-- Body -->
    <div style="padding:32px;">
      <p style="font-size:15px;line-height:1.6;color:#a1a1aa;margin:0 0 20px;">Hi <strong style="color:#e4e4e7;">${esc(displayName)}</strong>,</p>
      <p style="font-size:15px;line-height:1.6;color:#a1a1aa;margin:0 0 24px;">You've been added to the <strong style="color:#e4e4e7;">${esc(workspaceName)}</strong> workspace on PeopleOS. Here are your sign-in credentials:</p>
      <!-- Credentials box -->
      <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#71717a;font-size:13px;width:110px;">Email</td>
            <td style="padding:6px 0;color:#e4e4e7;font-size:14px;font-weight:600;font-family:monospace;">${esc(recipientEmail)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#71717a;font-size:13px;">Password</td>
            <td style="padding:6px 0;color:#a78bfa;font-size:14px;font-weight:700;font-family:monospace;letter-spacing:0.5px;">${esc(password)}</td>
          </tr>
          ${workspaceId ? `<tr>
            <td style="padding:6px 0;color:#71717a;font-size:13px;">Workspace ID</td>
            <td style="padding:6px 0;color:#e4e4e7;font-size:14px;font-family:monospace;">${esc(workspaceId)}</td>
          </tr>` : ''}
        </table>
      </div>
      <!-- CTA button -->
      <div style="text-align:center;margin:28px 0;">
        <a href="${esc(appUrl)}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:15px;font-weight:600;padding:13px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">Sign in to PeopleOS →</a>
      </div>
      <!-- Security note -->
      <div style="background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);border-radius:10px;padding:14px 18px;margin-top:8px;">
        <p style="font-size:13px;line-height:1.5;color:#ca8a04;margin:0;">
          🔒 <strong>For your security:</strong> Please change your password after your first sign-in. Go to your Account profile to update it.
        </p>
      </div>
    </div>
    <!-- Footer -->
    <div style="border-top:1px solid rgba(255,255,255,0.05);padding:20px 32px;text-align:center;">
      <p style="font-size:12px;color:#52525b;margin:0;">This is an automated message from PeopleOS. If you didn't expect this email, please contact your workspace administrator.</p>
    </div>
  </div>
</div>
</body>
</html>`;
}

function passwordChangedHtml({displayName, appUrl, workspaceName}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Password Updated</title></head>
<body style="margin:0;padding:0;background:#0f0f14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#e4e4e7;">
<div style="max-width:560px;margin:0 auto;padding:40px 20px;">
  <div style="background:linear-gradient(135deg,#18181f 0%,#1e1e2a 100%);border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
    <div style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);padding:30px 32px;text-align:center;">
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;">Password Updated ✓</h1>
      <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:6px 0 0;">${esc(workspaceName || 'Your workspace')}</p>
    </div>
    <div style="padding:32px;">
      <p style="font-size:15px;line-height:1.6;color:#a1a1aa;margin:0 0 16px;">Hi <strong style="color:#e4e4e7;">${esc(displayName)}</strong>,</p>
      <p style="font-size:15px;line-height:1.6;color:#a1a1aa;margin:0 0 24px;">Your password for PeopleOS has been successfully changed. Use your new password to sign in.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${esc(appUrl)}" style="display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#fff;font-size:15px;font-weight:600;padding:12px 32px;border-radius:10px;text-decoration:none;">Sign in →</a>
      </div>
      <p style="font-size:13px;color:#71717a;margin:20px 0 0;text-align:center;">If you didn't make this change, contact your workspace administrator immediately.</p>
    </div>
  </div>
</div>
</body>
</html>`;
}

function passwordResetHtml({displayName, workspaceName, resetUrl}) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Reset your PeopleOS password</title></head>
<body style="margin:0;padding:0;background:#0f0f14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#e4e4e7"><div style="max-width:560px;margin:0 auto;padding:40px 20px"><div style="background:#18181f;border-radius:16px;border:1px solid rgba(255,255,255,.08);overflow:hidden"><div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:30px;text-align:center"><h1 style="color:#fff;font-size:23px;margin:0">Reset your password</h1><p style="color:#eee;font-size:14px;margin:8px 0 0">${esc(workspaceName || 'Your workspace')}</p></div><div style="padding:32px"><p style="font-size:15px;line-height:1.6;color:#c4c4cc">Hi <strong style="color:#fff">${esc(displayName)}</strong>,</p><p style="font-size:15px;line-height:1.6;color:#c4c4cc">We received a request to reset your PeopleOS password. This link expires in 30 minutes and can only be used once.</p><div style="text-align:center;margin:28px 0"><a href="${esc(resetUrl)}" style="display:inline-block;background:#7c67e8;color:#fff;font-size:15px;font-weight:600;padding:13px 32px;border-radius:9px;text-decoration:none">Choose a new password</a></div><p style="font-size:12px;line-height:1.6;color:#92929d">If you did not request this, you can ignore this email. Your password will not change.</p></div></div></div></body></html>`;
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
