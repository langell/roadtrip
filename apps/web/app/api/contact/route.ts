import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(5000),
});

export const POST = async (req: NextRequest) => {
  const body: unknown = await req.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const { name, email, subject, message } = parsed.data;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // In dev without a key, just log and return success so the form works
    console.warn('[contact] RESEND_API_KEY not set — email not sent');
    return NextResponse.json({ ok: true });
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: 'HipTrip Support <noreply@hiptrip.net>',
    to: 'support@hiptrip.net',
    replyTo: email,
    subject: `[Support] ${subject}`,
    text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    html: `
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
      <hr />
      <p style="white-space:pre-wrap">${message}</p>
    `,
  });

  if (error) {
    console.error('[contact] Resend error', error);
    return NextResponse.json({ error: 'SEND_FAILED' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
};
