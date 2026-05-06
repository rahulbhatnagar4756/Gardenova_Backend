/**
 * Generates an HTML email template for notifying a professional/partner that a new lead has been received.
 *
 * @param {string} professionalEmail - The email of the professional receiving the notification.
 * @param {string} userName - The name of the user/customer who submitted the lead.
 * @param {string} userEmail - The email of the user/customer who submitted the lead.
 * @param {string|null} description - The description of the lead provided by the user (can be null).
 * 
 * @param {string|null} category - The category of the lead provided by the user (can be null).
 * @param {string|null} size - The size of the lead provided by the user (can be null).
 * @returns {string} A string containing the HTML content for the email template.
 */
export const leadNotificationForProfessional = (
  professionalEmail: string,
  userName: string,
  userEmail: string,
  description: string | null,
  category: string | null,
  size: string | null
): string => {
/**
 * Formats a nullable string field for display in email templates.
 * - If the value is a non‑empty string, returns it as‑is.
 * - Otherwise returns 'Not provided'.
 *
 * @param value - The string value to format (can be null or empty).
 * @returns A safe, user‑friendly display string.
 */
  const formatField = (value: string | null): string => {
    return value && value.trim() !== '' ? value : 'Not provided';
  };
  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title></title>
  <style type="text/css">
    @media screen {
      @font-face {
        font-family: 'Montserrat';
        font-style: normal;
        font-weight: 100 900;
        font-display: swap;
        src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459Wlhyw.woff2) format('woff2');
      }
    }
    #outlook a { padding: 0; }
    .ExternalClass, .ReadMsgBody { width: 100%; }
    div[style*="margin: 14px 0;"], div[style*="margin: 16px 0;"] { margin: 0 !important; }
    @media only screen and (min-width: 621px) { .pc-container { width: 620px !important; } }
    @media only screen and (max-width: 620px) {
      .pc-footer-box-s1 { padding-left: 10px !important; padding-right: 10px !important; }
    }
  </style>
</head>

<body class="pc-fb-font" bgcolor="#ffffff"
  style="background-color: #ffffff; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 16px; width: 100% !important; margin: 0 !important; padding: 0; line-height: 1.5; -webkit-font-smoothing: antialiased;">

  <table style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;" width="100%" border="0" cellpadding="0" cellspacing="0">
    <tbody>
      <tr>
        <td style="padding: 0; vertical-align: top;" align="center" valign="top">
          <table class="pc-container" align="center"
            style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; margin: 0 auto; max-width: 620px;"
            width="100%" border="0" cellpadding="0" cellspacing="0">
            <tbody>
              <tr>
                <td align="left" style="vertical-align: top; padding: 0 10px;" valign="top">

                  <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;" width="100%">
                    <tbody><tr><td style="height: 20px; font-size: 0px; line-height: 20px;" valign="top">&nbsp;</td></tr></tbody>
                  </table>

                  <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;" width="100%">
                    <tbody>
                      <tr>
                        <td>

                          <!-- HEADER -->
                          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;" width="100%">
                            <tbody>
                              <tr>
                                <td style="vertical-align: top; padding: 20px; background-color: #2E3A30;" valign="top">
                                  <img src="https://newbucketassets.s3.sa-east-1.amazonaws.com/logo.png"
                                    alt="Kasagardem" border="0"
                                    style="width: 60px; margin: 0 auto; display: block; padding: 20px 0;" />
                                 </td>
                              </tr>
                            </tbody>
                          </table>

                          <!-- BODY -->
                          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;" width="100%">
                            <tbody>
                              <tr>
                                <td style="vertical-align: top; padding: 20px; background-color: #fbfbfb;" valign="top">
                                  <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;" width="100%">
                                    <tbody>

                                      <!-- Spacer -->
                                      <tr><td style="height: 20px; font-size: 0px;" valign="top">&nbsp;</td></tr>

                                      <!-- Title -->
                                      <tr>
                                        <td style="font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 700; line-height: 1.42; color: #424242; padding: 0 20px; text-align: center;">
                                          You've Got a New Lead!
                                         </td>
                                      </tr>

                                      <!-- Spacer -->
                                      <tr><td style="height: 50px; font-size: 0px;" valign="top">&nbsp;</td></tr>

                                      <!-- Greeting -->
                                      <tr>
                                        <td style="font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 400; color: #424242; padding: 0 20px;">
                                          Hello, <strong style="font-weight: 600; word-break: break-all;">${professionalEmail},</strong>
                                         </td>
                                      </tr>

                                      <!-- Spacer -->
                                      <tr><td style="height: 15px; font-size: 0px;" valign="top">&nbsp;</td></tr>

                                      <!-- Intro text -->
                                      <tr>
                                        <td style="font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 1.42; color: #424242; padding: 0 20px;">
                                          Great news! A new lead has been successfully received through your partnership with Kasagardem. A potential customer is interested in your services — here are their details:
                                         </td>
                                      </tr>

                                      <!-- Spacer -->
                                      <tr><td style="height: 10px; font-size: 0px;" valign="top">&nbsp;</td></tr>

                                      <!-- Lead Details Card -->
                                      <tr>
                                        <td style="vertical-align: top; padding: 20px; margin-top: 10px; display: block; border: 1px solid #2E3A302b; border-radius: 10px; background: #2E3A3012;" valign="top" align="center">
                                          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;">
                                            <tbody>
                                              <tr>
                                                <td style="font-size: 15px; font-weight: 600; color: #2E3A30; text-align: center; text-transform: uppercase;">
                                                  Lead Details
                                                 </td>
                                              </tr>
                                              <tr>
                                                <td style="font-size: 16px; font-weight: 400; color: #2E3A30; display: block; margin-top: 10px; border: 1px solid #2E3A303b; border-radius: 10px; background: #fff; padding: 10px 20px;">
                                                  <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;">
                                                    <tbody>
                                                      <tr>
                                                        <td style="width: 158px;"><p style="margin: 5px 0;">Customer Name</p></td>
                                                        <td><p style="margin: 5px 0;">:</p></td>
                                                        <td><p style="font-weight: 600; margin: 5px 0;">${userName}</p></td>
                                                      </tr>
                                                      <tr>
                                                        <td><p style="margin: 5px 0;">Email Address</p></td>
                                                        <td><p style="margin: 5px 0;">:</p></td>
                                                        <td>
                                                          <p style="font-weight: 600; margin: 5px 0;">
                                                            <a href="mailto:${userEmail}" style="color: #2E3A30; text-decoration: none;">${userEmail}</a>
                                                          </p>
                                                         </td>
                                                      </tr>
                                                      <!-- Description Row -->
                                                      <tr>
                                                        <td><p style="margin: 5px 0;">Description</p></td>
                                                        <td><p style="margin: 5px 0;">:</p></td>
                                                        <td><p style="font-weight: 600; margin: 5px 0;">${formatField(description)}</p></td>
                                                      </tr>
                                                      <!-- Category Row -->
                                                      <tr>
                                                        <td><p style="margin: 5px 0;">Category</p></td>
                                                        <td><p style="margin: 5px 0;">:</p></td>
                                                        <td><p style="font-weight: 600; margin: 5px 0;">${formatField(category)}</p></td>
                                                      </tr>
                                                      <!-- Size Row -->
                                                      <tr>
                                                        <td><p style="margin: 5px 0;">Size</p></td>
                                                        <td><p style="margin: 5px 0;">:</p></td>
                                                        <td><p style="font-weight: 600; margin: 5px 0;">${formatField(size)}</p></td>
                                                      </tr>
                                                    </tbody>
                                                  }</td>
                                                 </td>
                                              </tr>
                                            </tbody>
                                          }</td>
                                         </td>
                                      </tr>

                                      <!-- Spacer -->
                                      <tr><td style="height: 30px; font-size: 0px;" valign="top">&nbsp;</td></tr>

                                      <!-- What Happens Next -->
                                      <tr>
                                        <td style="font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 600; line-height: 1.42; color: #424242; padding: 0 20px; text-align: center;">
                                          What Happens Next?
                                         </td>
                                      </tr>

                                      <!-- Spacer -->
                                      <tr><td style="height: 15px; font-size: 0px;" valign="top">&nbsp;</td></tr>

                                      <!-- What Happens Next text -->
                                      <tr>
                                        <td style="font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 1.42; color: #424242; padding: 0 20px; text-align: center;">
                                          Our team will follow up with the customer on your behalf and keep you updated every step of the way. Get ready to connect and turn this lead into a valued client!
                                         </td>
                                      </tr>

                                      <!-- Spacer -->
                                      <tr><td style="height: 15px; font-size: 0px;" valign="top">&nbsp;</td></tr>

                                      <!-- Thank you -->
                                      <tr>
                                        <td style="font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 600; line-height: 1.42; color: #424242; padding: 20px; text-align: center;">
                                          Thank you for being a valued partner!
                                         </td>
                                      </tr>

                                      <!-- Spacer -->
                                      <tr><td style="height: 15px; font-size: 0px;" valign="top">&nbsp;</td></tr>

                                    </tbody>
                                  }</td>
                                 </td>
                              </tr>
                            </tbody>
                          </table>

                          <!-- FOOTER -->
                          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;" width="100%">
                            <tbody>
                              <tr>
                                <td style="vertical-align: top; padding: 40px 20px; background-color: #2E3A30;" valign="top">
                                  <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;" width="100%">
                                    <tbody>
                                      <tr>
                                        <td style="font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 1.62; color: #ffffff; padding: 0 20px; text-align: center;" align="center" valign="top">
                                          Questions about this lead or your partnership with us?<br />We're always here to support your growth!
                                         </td>
                                      </tr>
                                      <tr><td style="height: 15px; font-size: 0px;" valign="top">&nbsp;</td></tr>
                                      <tr>
                                        <td style="font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 1.62; color: #ffffff; padding: 0 20px; text-align: center;" align="center" valign="top">
                                          Need assistance? <a href="mailto:helpdesk@kasagardem.com" style="color: #fff;">helpdesk@kasagardem.com</a>
                                         </td>
                                      </tr>
                                    </tbody>
                                  }</td>
                                 </td>
                              </tr>
                            </tbody>
                          </table>

                         </td>
                      </tr>
                    </tbody>
                  </table>

                  <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;" width="100%">
                    <tbody><tr><td style="height: 20px; font-size: 20px; line-height: 20px;" valign="top">&nbsp;</td></tr></tbody>
                  </table>

                 </td>
              </tr>
            </tbody>
          }</td>
        </tr>
      </tr>
    </tbody>
  </table>
</body>
</html>
  `;
};