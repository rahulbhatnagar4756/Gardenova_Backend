
/**
 * Generates an HTML email template for Contact Us form submissions.
 *
 * This template formats the user's name, email, and message into a styled
 * HTML email that is sent to the admin. It includes branding, layout styling,
 * and environment-based dynamic values such as the app URL and admin email.
 *
 * @function contactUsEmailTemplate
 * @param {string} name - Name of the user who submitted the contact form.
 * @param {string} email - Email address of the user.
 * @param {string} message - Message content submitted by the user.
 * @returns {string} HTML string representing the formatted email template.
 *
 * @example
 * const html = contactUsEmailTemplate("John Doe", "john@example.com", "Hello!");
 */
export const contactUsEmailTemplate = (
  name: string,
  email: string,
  message: string
): string => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Contact Us Submission</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
      <tr>
        <td align="center">

          <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">

            <!-- Header -->
            <tr>
              <td align="center" style="background:#2E3A30;padding:30px;">
                <img
                  src="${process.env.APPDEV_URL}/plant-images/logo.jpg"
                  alt="Gardenova"
                  width="70"
                  style="display:block;"
                />
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding:40px 30px;">
                <h2 style="margin:0 0 20px;color:#2E3A30;text-align:center;">
                  New Contact Form Submission
                </h2>

                <p style="color:#555;font-size:16px;">
                  A new message has been submitted through the Gardenova contact form.
                </p>

                <table
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  style="
                    margin-top:20px;
                    border:1px solid #e5e5e5;
                    border-radius:8px;
                    background:#fafafa;
                  "
                >
                  <tr>
                    <td style="padding:20px;">
                      <p style="margin:0 0 12px;">
                        <strong>Name:</strong> ${name}
                      </p>

                      <p style="margin:0 0 12px;">
                        <strong>Email:</strong> ${email}
                      </p>

                      <p style="margin:0 0 8px;">
                        <strong>Message:</strong>
                      </p>

                      <div
                        style="
                          padding:15px;
                          background:#ffffff;
                          border:1px solid #ddd;
                          border-radius:6px;
                          white-space:pre-wrap;
                          color:#444;
                        "
                      >
                        ${message}
                      </div>
                    </td>
                  </tr>
                </table>

                <p style="margin-top:30px;color:#666;font-size:14px;">
                  This email was automatically generated from the Gardenova Contact Us form.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td
                align="center"
                style="
                  background:#2E3A30;
                  color:#ffffff;
                  padding:25px;
                  font-size:14px;
                "
              >
                Gardenova Support Team
                <br />
                <a
                  href="mailto:${process.env.ADMIN_EMAIL}"
                  style="color:#ffffff;"
                >
                  ${process.env.ADMIN_EMAIL}
                </a>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
  </html>
  `;
};
