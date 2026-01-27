/**
 * Email utility for sending invitation emails
 * Supports multiple email providers:
 * 1. Resend (recommended for production)
 * 2. Console logging (fallback for development)
 */

import { Resend } from 'resend';

interface SendInviteEmailParams {
  email: string;
  displayName: string;
  resetLink: string;
  role?: string;
}

/**
 * Send invitation email to a new user
 */
export async function sendInviteEmail(params: SendInviteEmailParams): Promise<{ success: boolean; error?: string }> {
  const { email, displayName, resetLink, role } = params;

  // Try Resend first (if API key is configured)
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_DOMAIN 
        ? `noreply@${process.env.RESEND_FROM_DOMAIN}`
        : 'onboarding@resend.dev'; // Default Resend domain for testing
      
      const result = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: `Welcome to ${process.env.NEXT_PUBLIC_APP_NAME || 'Glammed Nails'} - Set Your Password`,
        html: getInviteEmailTemplate(displayName, resetLink, role),
      });

      if (result.data) {
        console.log(`✅ Invitation email sent via Resend to ${email} (ID: ${result.data.id})`);
        return { success: true };
      } else if (result.error) {
        console.error('Resend API error:', result.error);
        return { success: false, error: result.error.message || 'Failed to send email' };
      }
    } catch (error: any) {
      console.error('Error sending email via Resend:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  // Try Firebase Auth built-in email (if action code settings are configured)
  // Note: Firebase Admin SDK doesn't directly send emails, but we can use
  // the client SDK's sendPasswordResetEmail if we have a way to call it
  // For now, we'll log the link as a fallback

  // Fallback: Log the link (for development)
  console.log('\n📧 ============================================');
  console.log('📧 INVITATION EMAIL (Development Mode)');
  console.log('📧 ============================================');
  console.log(`To: ${email}`);
  console.log(`Subject: Welcome to ${process.env.NEXT_PUBLIC_APP_NAME || 'Glammed Nails'} - Set Your Password`);
  console.log(`\nHello ${displayName},\n`);
  console.log(`You have been invited to join ${process.env.NEXT_PUBLIC_APP_NAME || 'Glammed Nails'} as a ${role || 'user'}.`);
  console.log(`\nPlease click the link below to set your password:\n`);
  console.log(`${resetLink}\n`);
  console.log('📧 ============================================\n');

  return { success: true };
}

/**
 * Generate HTML email template for invitation
 */
function getInviteEmailTemplate(displayName: string, resetLink: string, role?: string): string {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Glammed Nails';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to ${appName}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to ${appName}!</h1>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-top: 0;">Hello ${displayName},</p>
        
        <p style="font-size: 16px;">
          You have been invited to join ${appName}${role ? ` as a <strong>${role}</strong>` : ''}.
        </p>
        
        <p style="font-size: 16px;">
          To get started, please click the button below to set your password:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Set Your Password
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666; margin-top: 30px;">
          If the button doesn't work, copy and paste this link into your browser:
        </p>
        <p style="font-size: 12px; color: #999; word-break: break-all; background: #fff; padding: 10px; border-radius: 4px; border: 1px solid #e5e7eb;">
          ${resetLink}
        </p>
        
        <p style="font-size: 14px; color: #666; margin-top: 30px;">
          This link will expire in 7 days. If you didn't request this invitation, you can safely ignore this email.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
          © ${new Date().getFullYear()} ${appName}. All rights reserved.
        </p>
      </div>
    </body>
    </html>
  `;
}
