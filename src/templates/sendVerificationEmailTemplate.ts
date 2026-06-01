
/**
 * Generates the HTML template for the email verification message.
 *
 * This template includes:
 * - A branded email layout
 * - Verification OTP/code
 * - Expiration timestamp
 * - Security instructions for the user
 *
 * The generated HTML is intended to be used with email services
 * such as Nodemailer.
 *
 * @function sendVerificationEmailTemplate
 *
 * @param {string} code - The 4-digit verification code sent to the user.
 * @param {Date} expiration - Expiration date and time of the verification code.
 *
 * @returns {string} HTML string for the verification email template.
 *
 * @example
 * const html = sendVerificationEmailTemplate(
 *   "4831",
 *   new Date(Date.now() + 10 * 60 * 1000)
 * );
 */
export const sendVerificationEmailTemplate = (
  code: string,
  expiration: Date
): string => {
  return `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml">

  <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Email Verification</title>
  </head>

  <body style="margin:0; padding:0; font-family: 'Montserrat', Arial, sans-serif; background:#ffffff;">

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">

          <!-- Container -->
          <table width="620" cellpadding="0" cellspacing="0" border="0" style="max-width:620px; width:100%;">

            <!-- HEADER -->
            <tr>
              <td style="background:#2E3A30; padding:20px; text-align:center;">
                <img src="${process.env.APPDEV_URL}/plant_images/logo.jpg"
                     width="60" alt="GARDENOVA Logo" />
              </td>
            </tr>

            <!-- BODY -->
            <tr>
              <td style="background:#fbfbfb; padding:30px 20px;">

                <h2 style="text-align:center; color:#424242; margin:0;">
                  Email Verification
                </h2>

                <p style="margin-top:20px; color:#424242;">
                  Hello,
                </p>

                <p style="color:#424242;">
                  Use the verification code below to verify your GARDENOVA account.
                </p>

                <!-- CODE BOX -->
                <div style="
                  margin:20px auto;
                  padding:15px;
                  text-align:center;
                  border:1px solid #2E3A303b;
                  background:#fff;
                  border-radius:10px;
                  font-size:22px;
                  letter-spacing:6px;
                  font-weight:600;
                  color:#2E3A30;
                  width:fit-content;
                ">
                  ${code}
                </div>

                <p style="text-align:center; color:#424242;">
                  This code expires at <strong>${expiration.toLocaleString()}</strong>
                </p>

                <hr style="margin:30px 0; border:0; border-top:1px solid #ddd;" />

                <h3 style="color:#424242;">Security Tips</h3>
                <ul style="color:#424242;">
                  <li>Never share your verification code with anyone</li>
                  <li>GARDENOVA will never ask for this code via email or phone</li>
                  <li>If you didn’t request this, ignore this email</li>
                </ul>

              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background:#2E3A30; padding:25px; text-align:center; color:#fff; font-size:13px;">
                If you didn’t request this email, please contact support immediately.<br/>
                <a href="mailto:helpdesk@GARDENOVA.com" style="color:#fff;">
                  helpdesk@GARDENOVA.com
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
