/**
 * Generates the email content for the user confirming their quote request.
 *
 * This template is used to notify the user that their request has been successfully
 * submitted to multiple partners.
 *
 * @param {Array<{name: string, logoUrl?: string}>} partners - Array of partner objects with name and optional logo.
 * @param {string} userName - The name of the user receiving the email.
 *
 * @returns {string} - The HTML content of the email to send to the user.
 *
 */
export const leadSuccessEmailTemplateForUser = (
  partners: Array<{ name: string; logoUrl?: string }>,
  userName: string
): string => {
  const partnerCount = partners.length;
  const partnerNames = partners.map((p) => p.name).join(", ");

  return `
    <!DOCTYPE html
    PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml"
    xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="format-detection" content="telephone=no" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title></title>
    <style type="text/css">
        @media screen {

            /* cyrillic-ext */
            @font-face {
                font-family: 'Montserrat';
                font-style: italic;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRxC7mw9c.woff2) format('woff2');
                unicode-range: U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
            }

            /* cyrillic */
            @font-face {
                font-family: 'Montserrat';
                font-style: italic;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRzS7mw9c.woff2) format('woff2');
                unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
            }

            /* vietnamese */
            @font-face {
                font-family: 'Montserrat';
                font-style: italic;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRxi7mw9c.woff2) format('woff2');
                unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
            }

            /* latin-ext */
            @font-face {
                font-family: 'Montserrat';
                font-style: italic;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRxy7mw9c.woff2) format('woff2');
                unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
            }

            /* latin */
            @font-face {
                font-family: 'Montserrat';
                font-style: italic;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRyS7m.woff2) format('woff2');
                unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
            }

            /* cyrillic-ext */
            @font-face {
                font-family: 'Montserrat';
                font-style: normal;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459WRhyzbi.woff2) format('woff2');
                unicode-range: U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
            }

            /* cyrillic */
            @font-face {
                font-family: 'Montserrat';
                font-style: normal;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459W1hyzbi.woff2) format('woff2');
                unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
            }

            /* vietnamese */
            @font-face {
                font-family: 'Montserrat';
                font-style: normal;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459WZhyzbi.woff2) format('woff2');
                unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
            }

            /* latin-ext */
            @font-face {
                font-family: 'Montserrat';
                font-style: normal;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459Wdhyzbi.woff2) format('woff2');
                unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
            }

            /* latin */
            @font-face {
                font-family: 'Montserrat';
                font-style: normal;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459Wlhyw.woff2) format('woff2');
                unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
            }
        }

        #outlook a {
            padding: 0;
        }

        .ExternalClass,
        .ReadMsgBody {
            width: 100%;
        }

        .ExternalClass,
        .ExternalClass p,
        .ExternalClass td,
        .ExternalClass div,
        .ExternalClass span,
        .ExternalClass font {
            line-height: 100%;
        }

        div[style*="margin: 14px 0;"],
        div[style*="margin: 16px 0;"] {
            margin: 0 !important;
        }

        @media only screen and (min-width:621px) {
            .pc-container {
                width: 620px !important;
            }
        }

        @media only screen and (max-width:620px) {
            .pc-header-box-s6 .pc-header-box-in {
                padding: 29px 16px 26px !important
            }

            .pc-header-logo-s1,
            .pc-header-nav-s1 {
                width: 100% !important
            }

            .pc-header-cta-s4 {
                text-align: center !important
            }

            .pc-footer-row-s1 .pc-footer-row-col,
            .pc-header-cta-s4 .pc-header-cta-col {
                max-width: 100% !important
            }

            .pc-header-cta-s4 .pc-header-cta-acs,
            .pc-header-cta-s4 .pc-header-cta-icon,
            .pc-header-cta-s4 .pc-header-cta-img {
                Margin: 0 auto !important
            }

            .pc-header-cta-s4 .pc-header-cta-text br,
            .pc-header-cta-s4 .pc-header-cta-title br {
                display: none !important
            }

            .pc-features-row-s1 .pc-features-row-col {
                max-width: 50% !important
            }

            .pc-cta-box-s14 .pc-cta-box-in {
                padding-bottom: 35px !important;
                padding-top: 35px !important
            }

            .pc-footer-box-s1 {
                padding-left: 10px !important;
                padding-right: 10px !important
            }

            .pc-spacing.pc-m-footer-h-46 td,
            .pc-spacing.pc-m-footer-h-57 td {
                font-size: 20px !important;
                height: 20px !important;
                line-height: 20px !important
            }
        }

        @media only screen and (max-width:525px) {
            .pc-header-box-s6 .pc-header-box-in {
                padding: 15px 6px 5px !important
            }

            .pc-spacing.pc-m-header-7 {
                font-size: 22px !important;
                height: 22px !important;
                line-height: 22px !important
            }

            .pc-cta-title br,
            .pc-footer-text-s1 br,
            .pc-header-cta-text br,
            .pc-header-cta-title br {
                display: none !important
            }

            .pc-features-row-s1 .pc-features-row-col {
                max-width: 100% !important
            }

            .pc-cta-box-s14 .pc-cta-box-in {
                padding: 25px 20px !important
            }

            .pc-cta-s1 .pc-cta-title {
                font-size: 24px !important;
                line-height: 1.42 !important
            }

            .pc-cta-icon.pc-m-module-18 {
                height: auto !important;
                width: 72px !important
            }

            .pc-footer-box-s1 {
                padding: 5px 0 !important
            }
        }
    </style>
    <!--[if mso]>
    <style type="text/css">
      .pc-fb-font{font-family:Helvetica,Arial,sans-serif !important;}
    </style>
    <![endif]-->
    <!--[if gte mso 9]>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
    <![endif]-->
</head>

<body class="pc-fb-font" bgcolor="#ffffff"
    style="background-color: #ffffff; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 16px; width: 100% !important; Margin: 0 !important; padding: 0; line-height: 1.5; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%">
    <table style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;" width="100%" border="0" cellpadding="0"
        cellspacing="0">
        <tbody>
            <tr>
                <td style="padding: 0; vertical-align: top;" align="center" valign="top">
                    <!--[if (gte mso 9)|(IE)]>
                    <table width="620" align="center" border="0" cellspacing="0" cellpadding="0"><tr><td width="620" align="center" valign="top">
                    <![endif]-->
                    <table class="pc-container" align="center"
                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; Margin: 0 auto; max-width: 620px;"
                        width="100%" border="0" cellpadding="0" cellspacing="0">
                        <tbody>
                            <tr>
                                <td align="left" style="vertical-align: top; padding: 0 10px;" valign="top">
                                    <table border="0" cellpadding="0" cellspacing="0"
                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;" width="100%">
                                        <tbody>
                                            <tr>
                                                <td style="vertical-align: top; padding: 0; height: 20px; font-size: 0px; line-height: 20px;"
                                                    valign="top">&nbsp;</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width:100%;" border="0"
                                        cellspacing="0" cellpadding="0" width="100%">
                                        <tbody>
                                            <tr>
                                                <td>

                                                    <!-- START MODULE: Feature 1 -->
                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                        width="100%">
                                                        <tbody>
                                                            <tr>
                                                                <td class="pc-features-box-s1"
                                                                    style="vertical-align: top; padding: 20px 20px; background-color: #2E3A30;"
                                                                    valign="top">
                                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                        width="100%">
                                                                        <tbody>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 700; line-height: 1.42; letter-spacing: -0.4px; color: #151515; padding: 0 20px;"
                                                                                    valign="top">



                                                                                    <img src="https://newbucketassets.s3.sa-east-1.amazonaws.com/logo.png"
                                                                                        alt="Group-3" border="0" style="
    width: 60px;
    margin: 0 auto;
    display: block;
    padding: 20px 0;
">
                                                                                </td>
                                                                            </tr>


                                                                        </tbody>
                                                                    </table>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                    <!-- END MODULE: Feature 1 -->
                                                    <!-- START MODULE: Feature 1 -->
                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                        width="100%">
                                                        <tbody>
                                                            <tr>
                                                                <td class="pc-features-box-s1"
                                                                    style="vertical-align: top; padding: 20px 20px; background-color: #fbfbfb;"
                                                                    valign="top">
                                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                        width="100%">
                                                                        <tbody>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 20px; font-size: 0px; line-height: 20px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 700; line-height: 1.42; letter-spacing: -0.4px; color: #424242; padding: 0 20px;text-align: center;">
                                                                                  Request Successfully Received
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 50px; font-size:0px; line-height: 50px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>                                                                            

                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 1.42; letter-spacing: -0.4px; color: #424242; padding: 0 20px; ">
                                                                                    Dear <strong
                                                                                        style="font-weight: 600;word-break: break-all;">${userName},</strong>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 15px; font-size: 0px; line-height: 15px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 1.42; letter-spacing: -0.4px; color: #424242; padding: 0 20px; ">

                                                                                Thank you for choosing Kasagardem! We're delighted to inform you that your quote request has been successfully received and forwarded to
                                                                                <span style=" font-weight: 600;" >
                                                                                    ${partnerCount} trusted partner${partnerCount > 1 ? "s" : ""}: ${partnerNames}
                                                                                </span>
                                                                                .

                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 10px; font-size: 0px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>

                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 1.42; letter-spacing: -0.4px; color: #424242; padding: 0 20px; ">
                                                                                   Our team is carefully reviewing your requirements and will respond shortly with ${partnerCount > 1 ? "tailored quotes" : "a tailored quote"} designed specifically for your gardening needs.

                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 10px; font-size: 0px; line-height: 10px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                           
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 30px; font-size: 0px; line-height: 30px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="    vertical-align: top;
    font-family: 'Montserrat', Helvetica, Arial, sans-serif;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.42;
    letter-spacing: -0.4px;
    color: #424242;
    padding: 0 20px;" valign="top">What Happens Next?
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 15px; font-size: 0px; line-height: 15px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 1.42; letter-spacing: -0.4px; color: #424242; padding: 0 20px; ">

                                                                                    <ul
                                                                                        style="padding-left: 20px; margin-top: 0;">
                                                                                        <li>
                                                                                            Our team carefully reviews your requirements
                                                                                        </li>
                                                                                        <li>
                                                                                           ${partnerCount > 1 ? "Partners" : "Partner"} prepare${partnerCount === 1 ? "s" : ""} personalized quote${partnerCount > 1 ? "s" : ""} for you
                                                                                        </li>
                                                                                        <li>
                                                                                             You'll receive our response within 24-48 hours
                                                                                        </li>
                                                                                    </ul>

                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 15px; font-size: 0px; line-height: 15px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>                                                                            
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 15px; font-size: 0px; line-height: 15px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>


                                                                           



                                                                        </tbody>
                                                                    </table>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                    <!-- END MODULE: Feature 1 -->

                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                        width="100%">
                                                        <tbody>
                                                            <tr>
                                                                <td class="pc-features-box-s1"
                                                                    style="vertical-align: top; padding: 40px 20px; background-color: #2E3A30;"
                                                                    valign="top">
                                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                        width="100%">
                                                                        <tbody>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 1.62; letter-spacing: -0.4px; color: #ffffff; padding: 0 20px;text-align: center;"
                                                                                    align="center" valign="top">
                                                                                   If you have any questions or didn't request this quote,
                                                                                    <br>
                                                                                   please contact us immediately.
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top; height: 15px; font-size: 0px; line-height: 15px;"
                                                                                    valign="top">&nbsp;
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 1.62; letter-spacing: -0.4px; color: #ffffff; padding: 0 20px;text-align: center;"
                                                                                    align="center" valign="top">
                                                                                    Need assistance?
                                                                                    <a
                                                                                        href="mailto:helpdesk@kasagardem.com" style="
    color: #fff;
">helpdesk@kasagardem.com.</a>
                                                                                </td>
                                                                            </tr>


                                                                        </tbody>
                                                                    </table>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>



                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table border="0" cellpadding="0" cellspacing="0"
                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;" width="100%">
                                        <tbody>
                                            <tr>
                                                <td style="vertical-align: top; padding: 0; height: 20px; font-size: 20px; line-height: 20px;"
                                                    valign="top">&nbsp;</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <!--[if (gte mso 9)|(IE)]>
                    </td></tr></table>
                    <![endif]-->
                </td>
            </tr>
        </tbody>
    </table>
</body>

</html>
  `;
};

/**
 * Generates the email content for the partner notifying them of a new lead.
 *
 * This template remains the same as it's sent individually to each partner.
 *
 * @param {string} partnerName - The name of the partner receiving the email.
 * @param {string} userName - The name of the user who submitted the lead.
 * @param {string} userEmail - The email of the user who submitted the lead.
 * @param {Object} [leadDetails] - Optional details about the lead.
 * @param {string} [leadDetails.phone] - The phone number of the lead.
 * @param {string} [leadDetails.message] - The message provided by the lead.
 * @param {string} [leadDetails.service] - The service the lead is interested in.
 *
 * @returns {string} - The HTML content of the email to send to the partner.
 *
 */
export const leadSuccessEmailTemplateForPartner = (
  partnerName: string,
  userName: string,
  userEmail: string,
  leadDetails?: {
    phone?: string;
    message?: string;
    service?: string;
  }
): string => {
  return `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html
   xmlns="http://www.w3.org/1999/xhtml"
   xmlns:v="urn:schemas-microsoft-com:vml"
   xmlns:o="urn:schemas-microsoft-com:office:office"
>
   <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <meta name="format-detection" content="telephone=no" />
      <meta name="x-apple-disable-message-reformatting" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title></title>
      <style type="text/css">
         @media screen {
            /* cyrillic-ext */
            @font-face {
               font-family: "Montserrat";
               font-style: italic;
               font-weight: 100 900;
               font-display: swap;
               src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRxC7mw9c.woff2)
                  format("woff2");
               unicode-range: U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF,
                  U+A640-A69F, U+FE2E-FE2F;
            }

            /* cyrillic */
            @font-face {
               font-family: "Montserrat";
               font-style: italic;
               font-weight: 100 900;
               font-display: swap;
               src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRzS7mw9c.woff2)
                  format("woff2");
               unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1,
                  U+2116;
            }

            /* vietnamese */
            @font-face {
               font-family: "Montserrat";
               font-style: italic;
               font-weight: 100 900;
               font-display: swap;
               src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRxi7mw9c.woff2)
                  format("woff2");
               unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169,
                  U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304,
                  U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
            }

            /* latin-ext */
            @font-face {
               font-family: "Montserrat";
               font-style: italic;
               font-weight: 100 900;
               font-display: swap;
               src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRxy7mw9c.woff2)
                  format("woff2");
               unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7,
                  U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F,
                  U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113,
                  U+2C60-2C7F, U+A720-A7FF;
            }

            /* latin */
            @font-face {
               font-family: "Montserrat";
               font-style: italic;
               font-weight: 100 900;
               font-display: swap;
               src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRyS7m.woff2)
                  format("woff2");
               unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC,
                  U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F,
                  U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
            }

            /* cyrillic-ext */
            @font-face {
               font-family: "Montserrat";
               font-style: normal;
               font-weight: 100 900;
               font-display: swap;
               src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459WRhyzbi.woff2)
                  format("woff2");
               unicode-range: U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF,
                  U+A640-A69F, U+FE2E-FE2F;
            }

            /* cyrillic */
            @font-face {
               font-family: "Montserrat";
               font-style: normal;
               font-weight: 100 900;
               font-display: swap;
               src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459W1hyzbi.woff2)
                  format("woff2");
               unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1,
                  U+2116;
            }

            /* vietnamese */
            @font-face {
               font-family: "Montserrat";
               font-style: normal;
               font-weight: 100 900;
               font-display: swap;
               src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459WZhyzbi.woff2)
                  format("woff2");
               unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169,
                  U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304,
                  U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
            }

            /* latin-ext */
            @font-face {
               font-family: "Montserrat";
               font-style: normal;
               font-weight: 100 900;
               font-display: swap;
               src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459Wdhyzbi.woff2)
                  format("woff2");
               unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7,
                  U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F,
                  U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113,
                  U+2C60-2C7F, U+A720-A7FF;
            }

            /* latin */
            @font-face {
               font-family: "Montserrat";
               font-style: normal;
               font-weight: 100 900;
               font-display: swap;
               src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459Wlhyw.woff2)
                  format("woff2");
               unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC,
                  U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F,
                  U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
            }
         }

         #outlook a {
            padding: 0;
         }

         .ExternalClass,
         .ReadMsgBody {
            width: 100%;
         }

         .ExternalClass,
         .ExternalClass p,
         .ExternalClass td,
         .ExternalClass div,
         .ExternalClass span,
         .ExternalClass font {
            line-height: 100%;
         }

         div[style*="margin: 14px 0;"],
         div[style*="margin: 16px 0;"] {
            margin: 0 !important;
         }

         @media only screen and (min-width: 621px) {
            .pc-container {
               width: 620px !important;
            }
         }

         @media only screen and (max-width: 620px) {
            .pc-header-box-s6 .pc-header-box-in {
               padding: 29px 16px 26px !important;
            }

            .pc-header-logo-s1,
            .pc-header-nav-s1 {
               width: 100% !important;
            }

            .pc-header-cta-s4 {
               text-align: center !important;
            }

            .pc-footer-row-s1 .pc-footer-row-col,
            .pc-header-cta-s4 .pc-header-cta-col {
               max-width: 100% !important;
            }

            .pc-header-cta-s4 .pc-header-cta-acs,
            .pc-header-cta-s4 .pc-header-cta-icon,
            .pc-header-cta-s4 .pc-header-cta-img {
               margin: 0 auto !important;
            }

            .pc-header-cta-s4 .pc-header-cta-text br,
            .pc-header-cta-s4 .pc-header-cta-title br {
               display: none !important;
            }

            .pc-features-row-s1 .pc-features-row-col {
               max-width: 50% !important;
            }

            .pc-cta-box-s14 .pc-cta-box-in {
               padding-bottom: 35px !important;
               padding-top: 35px !important;
            }

            .pc-footer-box-s1 {
               padding-left: 10px !important;
               padding-right: 10px !important;
            }

            .pc-spacing.pc-m-footer-h-46 td,
            .pc-spacing.pc-m-footer-h-57 td {
               font-size: 20px !important;
               height: 20px !important;
               line-height: 20px !important;
            }
         }

         @media only screen and (max-width: 525px) {
            .pc-header-box-s6 .pc-header-box-in {
               padding: 15px 6px 5px !important;
            }

            .pc-spacing.pc-m-header-7 {
               font-size: 22px !important;
               height: 22px !important;
               line-height: 22px !important;
            }

            .pc-cta-title br,
            .pc-footer-text-s1 br,
            .pc-header-cta-text br,
            .pc-header-cta-title br {
               display: none !important;
            }

            .pc-features-row-s1 .pc-features-row-col {
               max-width: 100% !important;
            }

            .pc-cta-box-s14 .pc-cta-box-in {
               padding: 25px 20px !important;
            }

            .pc-cta-s1 .pc-cta-title {
               font-size: 24px !important;
               line-height: 1.42 !important;
            }

            .pc-cta-icon.pc-m-module-18 {
               height: auto !important;
               width: 72px !important;
            }

            .pc-footer-box-s1 {
               padding: 5px 0 !important;
            }
         }
      </style>
      <!--[if mso]>
         <style type="text/css">
            .pc-fb-font {
               font-family: Helvetica, Arial, sans-serif !important;
            }
         </style>
      <![endif]-->
      <!--[if gte mso 9]>
         <xml>
            <o:OfficeDocumentSettings>
               <o:AllowPNG />
               <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
         </xml>
      <![endif]-->
   </head>

   <body
      class="pc-fb-font"
      bgcolor="#ffffff"
      style="
         background-color: #ffffff;
         font-family: &quot;Montserrat&quot;, Helvetica, Arial, sans-serif;
         font-size: 16px;
         width: 100% !important;
         margin: 0 !important;
         padding: 0;
         line-height: 1.5;
         -webkit-font-smoothing: antialiased;
         -webkit-text-size-adjust: 100%;
         -ms-text-size-adjust: 100%;
      "
   >
      <table
         style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%"
         width="100%"
         border="0"
         cellpadding="0"
         cellspacing="0"
      >
         <tbody>
            <tr>
               <td
                  style="padding: 0; vertical-align: top"
                  align="center"
                  valign="top"
               >
                  <!--[if (gte mso 9)|(IE)]>
                    <table width="620" align="center" border="0" cellspacing="0" cellpadding="0"><tr><td width="620" align="center" valign="top">
                    <![endif]-->
                  <table
                     class="pc-container"
                     align="center"
                     style="
                        mso-table-lspace: 0pt;
                        mso-table-rspace: 0pt;
                        width: 100%;
                        margin: 0 auto;
                        max-width: 620px;
                     "
                     width="100%"
                     border="0"
                     cellpadding="0"
                     cellspacing="0"
                  >
                     <tbody>
                        <tr>
                           <td
                              align="left"
                              style="vertical-align: top; padding: 0 10px"
                              valign="top"
                           >
                              <table
                                 border="0"
                                 cellpadding="0"
                                 cellspacing="0"
                                 style="
                                    mso-table-lspace: 0pt;
                                    mso-table-rspace: 0pt;
                                    width: 100%;
                                 "
                                 width="100%"
                              >
                                 <tbody>
                                    <tr>
                                       <td
                                          style="
                                             vertical-align: top;
                                             padding: 0;
                                             height: 20px;
                                             font-size: 0px;
                                             line-height: 20px;
                                          "
                                          valign="top"
                                       >
                                          &nbsp;
                                       </td>
                                    </tr>
                                 </tbody>
                              </table>
                              <table
                                 style="
                                    mso-table-lspace: 0pt;
                                    mso-table-rspace: 0pt;
                                    width: 100%;
                                 "
                                 border="0"
                                 cellspacing="0"
                                 cellpadding="0"
                                 width="100%"
                              >
                                 <tbody>
                                    <tr>
                                       <td>
                                          <!-- START MODULE: Feature 1 -->
                                          <table
                                             border="0"
                                             cellpadding="0"
                                             cellspacing="0"
                                             style="
                                                mso-table-lspace: 0pt;
                                                mso-table-rspace: 0pt;
                                                width: 100%;
                                             "
                                             width="100%"
                                          >
                                             <tbody>
                                                <tr>
                                                   <td
                                                      class="pc-features-box-s1"
                                                      style="
                                                         vertical-align: top;
                                                         padding: 20px 20px;
                                                         background-color: #2e3a30;
                                                      "
                                                      valign="top"
                                                   >
                                                      <table
                                                         border="0"
                                                         cellpadding="0"
                                                         cellspacing="0"
                                                         style="
                                                            mso-table-lspace: 0pt;
                                                            mso-table-rspace: 0pt;
                                                            width: 100%;
                                                         "
                                                         width="100%"
                                                      >
                                                         <tbody>
                                                            <tr>
                                                               <td
                                                                  class="pc-fb-font"
                                                                  style="
                                                                     vertical-align: top;
                                                                     font-family: &quot;Montserrat&quot;,
                                                                        Helvetica,
                                                                        Arial,
                                                                        sans-serif;
                                                                     font-size: 24px;
                                                                     font-weight: 700;
                                                                     line-height: 1.42;
                                                                     letter-spacing: -0.4px;
                                                                     color: #151515;
                                                                     padding: 0
                                                                        20px;
                                                                  "
                                                                  valign="top"
                                                               >
                                                                  <img
                                                                     src="https://newbucketassets.s3.sa-east-1.amazonaws.com/logo.png"
                                                                     alt="Group-3"
                                                                     border="0"
                                                                     style="
                                                                        width: 60px;
                                                                        margin: 0
                                                                           auto;
                                                                        display: block;
                                                                        padding: 20px
                                                                           0;
                                                                     "
                                                                  />
                                                               </td>
                                                            </tr>
                                                         </tbody>
                                                      </table>
                                                   </td>
                                                </tr>
                                             </tbody>
                                          </table>
                                          <!-- END MODULE: Feature 1 -->
                                          <!-- START MODULE: Feature 1 -->
                                          <table
                                             border="0"
                                             cellpadding="0"
                                             cellspacing="0"
                                             style="
                                                mso-table-lspace: 0pt;
                                                mso-table-rspace: 0pt;
                                                width: 100%;
                                             "
                                             width="100%"
                                          >
                                             <tbody>
                                                <tr>
                                                   <td
                                                      class="pc-features-box-s1"
                                                      style="
                                                         vertical-align: top;
                                                         padding: 20px 20px;
                                                         background-color: #fbfbfb;
                                                      "
                                                      valign="top"
                                                   >
                                                      <table
                                                         border="0"
                                                         cellpadding="0"
                                                         cellspacing="0"
                                                         style="
                                                            mso-table-lspace: 0pt;
                                                            mso-table-rspace: 0pt;
                                                            width: 100%;
                                                         "
                                                         width="100%"
                                                      >
                                                         <tbody>
                                                            <tr>
                                                               <td
                                                                  style="
                                                                     vertical-align: top;
                                                                  "
                                                                  valign="top"
                                                               >
                                                                  <table
                                                                     border="0"
                                                                     cellpadding="0"
                                                                     cellspacing="0"
                                                                     style="
                                                                        mso-table-lspace: 0pt;
                                                                        mso-table-rspace: 0pt;
                                                                        width: 100%;
                                                                     "
                                                                     width="100%"
                                                                  >
                                                                     <tbody>
                                                                        <tr>
                                                                           <td
                                                                              style="
                                                                                 vertical-align: top;
                                                                                 height: 20px;
                                                                                 font-size: 0px;
                                                                                 line-height: 20px;
                                                                              "
                                                                              valign="top"
                                                                           >
                                                                              &nbsp;
                                                                           </td>
                                                                        </tr>
                                                                     </tbody>
                                                                  </table>
                                                               </td>
                                                            </tr>
                                                            <tr>
                                                               <td
                                                                  class="pc-fb-font"
                                                                  style="
                                                                     vertical-align: top;
                                                                     font-family: &quot;Montserrat&quot;,
                                                                        Helvetica,
                                                                        Arial,
                                                                        sans-serif;
                                                                     font-size: 20px;
                                                                     font-weight: 700;
                                                                     line-height: 1.42;
                                                                     letter-spacing: -0.4px;
                                                                     color: #424242;
                                                                     padding: 0
                                                                        20px;
                                                                     text-align: center;
                                                                  "
                                                               >
                                                                  New Lead
                                                                  Growing!
                                                               </td>
                                                            </tr>
                                                            <tr>
                                                               <td
                                                                  style="
                                                                     vertical-align: top;
                                                                  "
                                                                  valign="top"
                                                               >
                                                                  <table
                                                                     border="0"
                                                                     cellpadding="0"
                                                                     cellspacing="0"
                                                                     style="
                                                                        mso-table-lspace: 0pt;
                                                                        mso-table-rspace: 0pt;
                                                                        width: 100%;
                                                                     "
                                                                     width="100%"
                                                                  >
                                                                     <tbody>
                                                                        <tr>
                                                                           <td
                                                                              style="
                                                                                 vertical-align: top;
                                                                                 height: 50px;
                                                                                 font-size: 0px;
                                                                                 line-height: 50px;
                                                                              "
                                                                              valign="top"
                                                                           >
                                                                              &nbsp;
                                                                           </td>
                                                                        </tr>
                                                                     </tbody>
                                                                  </table>
                                                               </td>
                                                            </tr>
                                                            <tr>
                                                               <td
                                                                  class="pc-fb-font"
                                                                  style="
                                                                     vertical-align: top;
                                                                     font-family: &quot;Montserrat&quot;,
                                                                        Helvetica,
                                                                        Arial,
                                                                        sans-serif;
                                                                     font-size: 16px;
                                                                     font-weight: 400;
                                                                     line-height: 1.42;
                                                                     letter-spacing: -0.4px;
                                                                     color: #424242;
                                                                     padding: 0
                                                                        20px;
                                                                  "
                                                               >
                                                                  Hello,
                                                                  <strong
                                                                     style="
                                                                        font-weight: 600;
                                                                        word-break: break-all;
                                                                     "
>${partnerName},</strong
                                                                  >
                                                               </td>
                                                            </tr>
                                                            <tr>
                                                               <td
                                                                  style="
                                                                     vertical-align: top;
                                                                  "
                                                                  valign="top"
                                                               >
                                                                  <table
                                                                     border="0"
                                                                     cellpadding="0"
                                                                     cellspacing="0"
                                                                     style="
                                                                        mso-table-lspace: 0pt;
                                                                        mso-table-rspace: 0pt;
                                                                        width: 100%;
                                                                     "
                                                                     width="100%"
                                                                  >
                                                                     <tbody>
                                                                        <tr>
                                                                           <td
                                                                              style="
                                                                                 vertical-align: top;
                                                                                 height: 15px;
                                                                                 font-size: 0px;
                                                                                 line-height: 15px;
                                                                              "
                                                                              valign="top"
                                                                           >
                                                                              &nbsp;
                                                                           </td>
                                                                        </tr>
                                                                     </tbody>
                                                                  </table>
                                                               </td>
                                                            </tr>
                                                            <tr>
                                                               <td
                                                                  class="pc-fb-font"
                                                                  style="
                                                                     vertical-align: top;
                                                                     font-family: &quot;Montserrat&quot;,
                                                                        Helvetica,
                                                                        Arial,
                                                                        sans-serif;
                                                                     font-size: 16px;
                                                                     font-weight: 400;
                                                                     line-height: 1.42;
                                                                     letter-spacing: -0.4px;
                                                                     color: #424242;
                                                                     padding: 0
                                                                        20px;
                                                                  "
                                                               >
                                                                  Wonderful
                                                                  news! A fresh
                                                                  lead has
                                                                  sprouted
                                                                  through your
                                                                  partnership
                                                                  with
                                                                  Kasagardem.
                                                                  This is an
                                                                  excellent
                                                                  opportunity to
                                                                  grow your
                                                                  business. Here
                                                                  are the
                                                                  details:
                                                               </td>
                                                            </tr>
                                                            <tr>
                                                               <td
                                                                  style="
                                                                     vertical-align: top;
                                                                  "
                                                                  valign="top"
                                                               >
                                                                  <table
                                                                     border="0"
                                                                     cellpadding="0"
                                                                     cellspacing="0"
                                                                     style="
                                                                        mso-table-lspace: 0pt;
                                                                        mso-table-rspace: 0pt;
                                                                        width: 100%;
                                                                     "
                                                                     width="100%"
                                                                  >
                                                                     <tbody>
                                                                        <tr>
                                                                           <td
                                                                              style="
                                                                                 vertical-align: top;
                                                                                 height: 10px;
                                                                                 font-size: 0px;
                                                                              "
                                                                              valign="top"
                                                                           >
                                                                              &nbsp;
                                                                           </td>
                                                                        </tr>
                                                                     </tbody>
                                                                  </table>
                                                               </td>
                                                            </tr>

                                                            <tr>
                                                               <td
                                                                  style="
                                                                     vertical-align: top;
                                                                  "
                                                                  valign="top"
                                                               >
                                                                  <table
                                                                     border="0"
                                                                     cellpadding="0"
                                                                     cellspacing="0"
                                                                     style="
                                                                        mso-table-lspace: 0pt;
                                                                        mso-table-rspace: 0pt;
                                                                        width: 100%;
                                                                     "
                                                                     width="100%"
                                                                  >
                                                                     <tbody>
                                                                        <tr>
                                                                           <td
                                                                              style="
                                                                                 vertical-align: top;
                                                                                 height: 10px;
                                                                                 font-size: 0px;
                                                                                 line-height: 10px;
                                                                              "
                                                                              valign="top"
                                                                           >
                                                                              &nbsp;
                                                                           </td>
                                                                        </tr>
                                                                     </tbody>
                                                                  </table>
                                                               </td>
                                                            </tr>
                                                            <tr>
                                                               <td
                                                                  style="
                                                                     vertical-align: top;
                                                                     padding: 20px
                                                                        20px;
                                                                     margin-top: 10px;
                                                                     display: block;
                                                                     border: 1px
                                                                        solid
                                                                        #2e3a302b;
                                                                     border-radius: 10px;
                                                                     background: #2e3a3012;
                                                                  "
                                                                  valign="top"
                                                                  align="center"
                                                               >
                                                                  <table
                                                                     border="0"
                                                                     cellpadding="0"
                                                                     cellspacing="0"
                                                                     style="
                                                                        mso-table-lspace: 0pt;
                                                                        mso-table-rspace: 0pt;
                                                                        width: 100%;
                                                                     "
                                                                  >
                                                                     <tbody
                                                                        style="
                                                                           vertical-align: top;
                                                                           border-radius: 8px;
                                                                           text-align: center;
                                                                        "
                                                                     >
                                                                        <tr>
                                                                           <td
                                                                              style="
                                                                                 font-size: 15px;
                                                                                 font-weight: 600;
                                                                                 color: #2e3a30;
                                                                                 text-align: center;
                                                                                 text-transform: uppercase;
                                                                              "
                                                                           >
                                                                              Lead
                                                                              Details
                                                                           </td>
                                                                        </tr>
                                                                        <tr>
                                                                           <td
                                                                              style="
                                                                                 font-size: 16px;
                                                                                 font-weight: 400;
                                                                                 color: #2e3a30;
                                                                                 text-align: center;
                                                                                 display: block;
                                                                                 margin-top: 10px;
                                                                                 border: 1px
                                                                                    solid
                                                                                    #2e3a303b;
                                                                                 border-radius: 10px;
                                                                                 background: #fff;
                                                                                 padding: 10px
                                                                                    20px;
                                                                              "
                                                                           >
                                                                              <table
                                                                                 border="0"
                                                                                 cellpadding="0"
                                                                                 cellspacing="0"
                                                                                 style="
                                                                                    mso-table-lspace: 0pt;
                                                                                    mso-table-rspace: 0pt;
                                                                                    width: 100%;
                                                                                 "
                                                                              >
                                                                                 <tbody
                                                                                    style="
                                                                                       vertical-align: top;
                                                                                       border-radius: 8px;
                                                                                    "
                                                                                 >
                                                                                    <tr>
                                                                                       <td
                                                                                          style="
                                                                                             width: 158px;
                                                                                          "
                                                                                       >
                                                                                          <p
                                                                                             style="
                                                                                                margin: 5px
                                                                                                   0;
                                                                                             "
                                                                                          >
                                                                                             Customer
                                                                                             Name
                                                                                          </p>
                                                                                       </td>
                                                                                       <td>
                                                                                          <p
                                                                                             style="
                                                                                                margin: 5px
                                                                                                   0;
                                                                                             "
                                                                                          >
                                                                                             :
                                                                                          </p>
                                                                                       </td>
                                                                                       <td>
                                                                                          <p
                                                                                             style="
                                                                                                font-weight: 600;
                                                                                                margin: 5px
                                                                                                   0;
                                                                                             "
                                                                                          >
                                                                                             ${userName}
                                                                                          </p>
                                                                                       </td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                       <td>
                                                                                          <p
                                                                                             style="
                                                                                                margin: 5px
                                                                                                   0;
                                                                                             "
                                                                                          >
                                                                                             Email
                                                                                             Address
                                                                                          </p>
                                                                                       </td>
                                                                                       <td>
                                                                                          <p
                                                                                             style="
                                                                                                margin: 5px
                                                                                                   0;
                                                                                             "
                                                                                          >
                                                                                             :
                                                                                          </p>
                                                                                       </td>
                                                                                       <td>
                                                                                          <p
                                                                                             style="
                                                                                                font-weight: 600;
                                                                                                margin: 5px
                                                                                                   0;
                                                                                             "
                                                                                          >
                                                                                             <a
                                                                                                href="#"
                                                                                                style="
                                                                                                   color: #2e3a30;
                                                                                                "
                                                                                             >
                                                                                                ${userEmail}</a
                                                                                             >
                                                                                          </p>
                                                                                       </td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                       <td>
                                                                                          <p
                                                                                             style="
                                                                                                margin: 5px
                                                                                                   0;
                                                                                             "
                                                                                          >
                                                                                             Phone
                                                                                             Number
                                                                                          </p>
                                                                                       </td>
                                                                                       <td>
                                                                                          <p
                                                                                             style="
                                                                                                margin: 5px
                                                                                                   0;
                                                                                             "
                                                                                          >
                                                                                             :
                                                                                          </p>
                                                                                       </td>
                                                                                       <td>
                                                                                          <p
                                                                                             style="
                                                                                                font-weight: 600;
                                                                                                margin: 5px
                                                                                                   0;
                                                                                             "
                                                                                          >
                                                                                             <a
                                                                                                href="#"
                                                                                                style="
                                                                                                   color: #2e3a30;
                                                                                                "
                                                                                             >
                                                                                                ${leadDetails?.phone}</a
                                                                                             >
                                                                                          </p>
                                                                                       </td>
                                                                                    </tr>
                                                                                 </tbody>
                                                                              </table>
                                                                           </td>
                                                                        </tr>
                                                                     </tbody>
                                                                  </table>
                                                               </td>
                                                            </tr>
                                                            <tr>
                                                               <td
                                                                  style="
                                                                     vertical-align: top;
                                                                  "
                                                                  valign="top"
                                                               >
                                                                  <table
                                                                     border="0"
                                                                     cellpadding="0"
                                                                     cellspacing="0"
                                                                     style="
                                                                        mso-table-lspace: 0pt;
                                                                        mso-table-rspace: 0pt;
                                                                        width: 100%;
                                                                     "
                                                                     width="100%"
                                                                  >
                                                                     <tbody>
                                                                        <tr>
                                                                           <td
                                                                              style="
                                                                                 vertical-align: top;
                                                                                 height: 30px;
                                                                                 font-size: 0px;
                                                                                 line-height: 30px;
                                                                              "
                                                                              valign="top"
                                                                           >
                                                                              &nbsp;
                                                                           </td>
                                                                        </tr>
                                                                     </tbody>
                                                                  </table>
                                                               </td>
                                                            </tr>
                                                            <tr>
                                                               <td
                                                                  style="
                                                                     vertical-align: top;
                                                                  "
                                                                  valign="top"
                                                               >
                                                                  <table
                                                                     border="0"
                                                                     cellpadding="0"
                                                                     cellspacing="0"
                                                                     style="
                                                                        mso-table-lspace: 0pt;
                                                                        mso-table-rspace: 0pt;
                                                                        width: 100%;
                                                                     "
                                                                     width="100%"
                                                                  >
                                                                     <tbody>
                                                                        <tr>
                                                                           <td
                                                                              style="
                                                                                 vertical-align: top;
                                                                                 font-family: &quot;Montserrat&quot;,
                                                                                    Helvetica,
                                                                                    Arial,
                                                                                    sans-serif;
                                                                                 font-size: 16px;
                                                                                 font-weight: 600;
                                                                                 line-height: 1.42;
                                                                                 letter-spacing: -0.4px;
                                                                                 color: #424242;
                                                                                 padding: 0
                                                                                    20px;
                                                                                 text-align: center;
                                                                              "
                                                                              valign="top"
                                                                           >
                                                                              Next
                                                                              Steps
                                                                              to
                                                                              Grow
                                                                              This
                                                                              Lead
                                                                           </td>
                                                                        </tr>
                                                                     </tbody>
                                                                  </table>
                                                               </td>
                                                            </tr>
                                                            <tr>
                                                               <td
                                                                  style="
                                                                     vertical-align: top;
                                                                  "
                                                                  valign="top"
                                                               >
                                                                  <table
                                                                     border="0"
                                                                     cellpadding="0"
                                                                     cellspacing="0"
                                                                     style="
                                                                        mso-table-lspace: 0pt;
                                                                        mso-table-rspace: 0pt;
                                                                        width: 100%;
                                                                     "
                                                                     width="100%"
                                                                  >
                                                                     <tbody>
                                                                        <tr>
                                                                           <td
                                                                              style="
                                                                                 vertical-align: top;
                                                                                 height: 15px;
                                                                                 font-size: 0px;
                                                                                 line-height: 15px;
                                                                              "
                                                                              valign="top"
                                                                           >
                                                                              &nbsp;
                                                                           </td>
                                                                        </tr>
                                                                     </tbody>
                                                                  </table>
                                                               </td>
                                                            </tr>
                                                            <tr>
                                                               <td
                                                                  class="pc-fb-font"
                                                                  style="
                                                                     vertical-align: top;
                                                                     text-align: center;
                                                                     font-family: &quot;Montserrat&quot;,
                                                                        Helvetica,
                                                                        Arial,
                                                                        sans-serif;
                                                                     font-size: 16px;
                                                                     font-weight: 400;
                                                                     line-height: 1.42;
                                                                     letter-spacing: -0.4px;
                                                                     color: #424242;
                                                                     padding: 0
                                                                        20px;
                                                                  "
                                                               >
                                                                  Our team will
                                                                  nurture this
                                                                  lead and reach
                                                                  out to the
                                                                  customer with
                                                                  personalized
                                                                  care. You'll
                                                                  be kept
                                                                  updated
                                                                  throughout the
                                                                  entire growth
                                                                  process.
                                                               </td>
                                                            </tr>

                                                            <tr>
                                                               <td
                                                                  style="
                                                                     vertical-align: top;
                                                                  "
                                                                  valign="top"
                                                               >
                                                                  <table
                                                                     border="0"
                                                                     cellpadding="0"
                                                                     cellspacing="0"
                                                                     style="
                                                                        mso-table-lspace: 0pt;
                                                                        mso-table-rspace: 0pt;
                                                                        width: 100%;
                                                                     "
                                                                     width="100%"
                                                                  >
                                                                     <tbody>
                                                                        <tr>
                                                                           <td
                                                                              style="
                                                                                 vertical-align: top;
                                                                                 height: 15px;
                                                                                 font-size: 0px;
                                                                                 line-height: 15px;
                                                                              "
                                                                              valign="top"
                                                                           >
                                                                              &nbsp;
                                                                           </td>
                                                                        </tr>
                                                                     </tbody>
                                                                  </table>
                                                               </td>
                                                            </tr>
                                                            <tr>
                                                               <td
                                                                  class="pc-fb-font"
                                                                  style="
                                                                     vertical-align: top;
                                                                     text-align: center;
                                                                     font-family: &quot;Montserrat&quot;,
                                                                        Helvetica,
                                                                        Arial,
                                                                        sans-serif;
                                                                     font-size: 20px;
                                                                     font-weight: 600;
                                                                     line-height: 1.42;
                                                                     color: #424242;
                                                                     padding: 20px;
                                                                  "
                                                               >
                                                                  Thank you for
                                                                  this
                                                                  partnership!
                                                               </td>
                                                            </tr>

                                                            <tr>
                                                               <td
                                                                  style="
                                                                     vertical-align: top;
                                                                  "
                                                                  valign="top"
                                                               >
                                                                  <table
                                                                     border="0"
                                                                     cellpadding="0"
                                                                     cellspacing="0"
                                                                     style="
                                                                        mso-table-lspace: 0pt;
                                                                        mso-table-rspace: 0pt;
                                                                        width: 100%;
                                                                     "
                                                                     width="100%"
                                                                  >
                                                                     <tbody>
                                                                        <tr>
                                                                           <td
                                                                              style="
                                                                                 vertical-align: top;
                                                                                 height: 15px;
                                                                                 font-size: 0px;
                                                                                 line-height: 15px;
                                                                              "
                                                                              valign="top"
                                                                           >
                                                                              &nbsp;
                                                                           </td>
                                                                        </tr>
                                                                     </tbody>
                                                                  </table>
                                                               </td>
                                                            </tr>
                                                            <tr>
                                                               <td
                                                                  style="
                                                                     vertical-align: top;
                                                                  "
                                                                  valign="top"
                                                               >
                                                                  <table
                                                                     border="0"
                                                                     cellpadding="0"
                                                                     cellspacing="0"
                                                                     style="
                                                                        mso-table-lspace: 0pt;
                                                                        mso-table-rspace: 0pt;
                                                                        width: 100%;
                                                                     "
                                                                     width="100%"
                                                                  >
                                                                     <tbody>
                                                                        <tr>
                                                                           <td
                                                                              style="
                                                                                 vertical-align: top;
                                                                                 height: 15px;
                                                                                 font-size: 0px;
                                                                                 line-height: 15px;
                                                                              "
                                                                              valign="top"
                                                                           >
                                                                              &nbsp;
                                                                           </td>
                                                                        </tr>
                                                                     </tbody>
                                                                  </table>
                                                               </td>
                                                            </tr>
                                                         </tbody>
                                                      </table>
                                                   </td>
                                                </tr>
                                             </tbody>
                                          </table>
                                          <!-- END MODULE: Feature 1 -->

                                          <table
                                             border="0"
                                             cellpadding="0"
                                             cellspacing="0"
                                             style="
                                                mso-table-lspace: 0pt;
                                                mso-table-rspace: 0pt;
                                                width: 100%;
                                             "
                                             width="100%"
                                          >
                                             <tbody>
                                                <tr>
                                                   <td
                                                      class="pc-features-box-s1"
                                                      style="
                                                         vertical-align: top;
                                                         padding: 40px 20px;
                                                         background-color: #2e3a30;
                                                      "
                                                      valign="top"
                                                   >
                                                      <table
                                                         border="0"
                                                         cellpadding="0"
                                                         cellspacing="0"
                                                         style="
                                                            mso-table-lspace: 0pt;
                                                            mso-table-rspace: 0pt;
                                                            width: 100%;
                                                         "
                                                         width="100%"
                                                      >
                                                         <tbody>
                                                            <tr>
                                                               <td
                                                                  class="pc-fb-font"
                                                                  style="
                                                                     vertical-align: top;
                                                                     font-family: &quot;Montserrat&quot;,
                                                                        Helvetica,
                                                                        Arial,
                                                                        sans-serif;
                                                                     font-size: 14px;
                                                                     font-weight: 400;
                                                                     line-height: 1.62;
                                                                     letter-spacing: -0.4px;
                                                                     color: #ffffff;
                                                                     padding: 0
                                                                        20px;
                                                                     text-align: center;
                                                                  "
                                                                  align="center"
                                                                  valign="top"
                                                               >
                                                                  Questions
                                                                  about this
                                                                  lead or our
                                                                  partnership?
                                                                  <br />
                                                                  We're here to
                                                                  help you grow!
                                                               </td>
                                                            </tr>
                                                            <tr>
                                                               <td
                                                                  style="
                                                                     vertical-align: top;
                                                                     height: 15px;
                                                                     font-size: 0px;
                                                                     line-height: 15px;
                                                                  "
                                                                  valign="top"
                                                               >
                                                                  &nbsp;
                                                               </td>
                                                            </tr>
                                                            <tr>
                                                               <td
                                                                  class="pc-fb-font"
                                                                  style="
                                                                     vertical-align: top;
                                                                     font-family: &quot;Montserrat&quot;,
                                                                        Helvetica,
                                                                        Arial,
                                                                        sans-serif;
                                                                     font-size: 14px;
                                                                     font-weight: 400;
                                                                     line-height: 1.62;
                                                                     letter-spacing: -0.4px;
                                                                     color: #ffffff;
                                                                     padding: 0
                                                                        20px;
                                                                     text-align: center;
                                                                  "
                                                                  align="center"
                                                                  valign="top"
                                                               >
                                                                  Need
                                                                  assistance?
                                                                  <a
                                                                     href="mailto:helpdesk@encrypttitan.com"
                                                                     style="
                                                                        color: #fff;
                                                                     "
                                                                     >helpdesk@encrypttitan.com.</a
                                                                  >
                                                               </td>
                                                            </tr>
                                                         </tbody>
                                                      </table>
                                                   </td>
                                                </tr>
                                             </tbody>
                                          </table>
                                       </td>
                                    </tr>
                                 </tbody>
                              </table>
                              <table
                                 border="0"
                                 cellpadding="0"
                                 cellspacing="0"
                                 style="
                                    mso-table-lspace: 0pt;
                                    mso-table-rspace: 0pt;
                                    width: 100%;
                                 "
                                 width="100%"
                              >
                                 <tbody>
                                    <tr>
                                       <td
                                          style="
                                             vertical-align: top;
                                             padding: 0;
                                             height: 20px;
                                             font-size: 20px;
                                             line-height: 20px;
                                          "
                                          valign="top"
                                       >
                                          &nbsp;
                                       </td>
                                    </tr>
                                 </tbody>
                              </table>
                           </td>
                        </tr>
                     </tbody>
                  </table>
                  <!--[if (gte mso 9)|(IE)]>
                    </td></tr></table>
                    <![endif]-->
               </td>
            </tr>
         </tbody>
      </table>
   </body>
</html>
  `;
};

/**
 * Generates the email content for the admin notifying them of a new lead.
 *
 * This template is updated to handle multiple partners.
 *
 * @param {Array<{name: string, email: string}>} partners - Array of partner objects with name and email.
 * @param {string} userName - The name of the user who submitted the lead.
 * @param {string} userEmail - The email of the user who submitted the lead.
 * @param {Object} [leadDetails] - Optional additional details about the lead.
 * @param {string} [leadDetails.phone] - The phone number of the lead.
 * @param {string} [leadDetails.message] - The message provided by the lead.
 * @param {string} [leadDetails.service] - The service the lead is interested in.
 * @param {string} [leadDetails.leadId] - Unique identifier for the lead.
 * @param {string} [leadDetails.timestamp] - Timestamp of when the lead was created.
 *
 * @returns {string} - The HTML content of the email to send to the admin.
 *
 */
export const leadSuccessEmailTemplateForAdmin = (
  partners: Array<{ name: string; email: string }>,
  userName: string,
  userEmail: string,
  leadDetails?: {
    phone?: string;
    message?: string;
    service?: string;
    leadId?: string;
    timestamp?: string;
  }
): string => {
  const partnerCount = partners.length;
  return `
   <!DOCTYPE html
    PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml"
    xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="format-detection" content="telephone=no" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title></title>
    <style type="text/css">
        @media screen {

            /* cyrillic-ext */
            @font-face {
                font-family: 'Montserrat';
                font-style: italic;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRxC7mw9c.woff2) format('woff2');
                unicode-range: U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
            }

            /* cyrillic */
            @font-face {
                font-family: 'Montserrat';
                font-style: italic;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRzS7mw9c.woff2) format('woff2');
                unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
            }

            /* vietnamese */
            @font-face {
                font-family: 'Montserrat';
                font-style: italic;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRxi7mw9c.woff2) format('woff2');
                unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
            }

            /* latin-ext */
            @font-face {
                font-family: 'Montserrat';
                font-style: italic;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRxy7mw9c.woff2) format('woff2');
                unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
            }

            /* latin */
            @font-face {
                font-family: 'Montserrat';
                font-style: italic;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRyS7m.woff2) format('woff2');
                unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
            }

            /* cyrillic-ext */
            @font-face {
                font-family: 'Montserrat';
                font-style: normal;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459WRhyzbi.woff2) format('woff2');
                unicode-range: U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
            }

            /* cyrillic */
            @font-face {
                font-family: 'Montserrat';
                font-style: normal;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459W1hyzbi.woff2) format('woff2');
                unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
            }

            /* vietnamese */
            @font-face {
                font-family: 'Montserrat';
                font-style: normal;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459WZhyzbi.woff2) format('woff2');
                unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
            }

            /* latin-ext */
            @font-face {
                font-family: 'Montserrat';
                font-style: normal;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459Wdhyzbi.woff2) format('woff2');
                unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
            }

            /* latin */
            @font-face {
                font-family: 'Montserrat';
                font-style: normal;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459Wlhyw.woff2) format('woff2');
                unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
            }
        }

        #outlook a {
            padding: 0;
        }

        .ExternalClass,
        .ReadMsgBody {
            width: 100%;
        }

        .ExternalClass,
        .ExternalClass p,
        .ExternalClass td,
        .ExternalClass div,
        .ExternalClass span,
        .ExternalClass font {
            line-height: 100%;
        }

        div[style*="margin: 14px 0;"],
        div[style*="margin: 16px 0;"] {
            margin: 0 !important;
        }

        @media only screen and (min-width:621px) {
            .pc-container {
                width: 620px !important;
            }
        }

        @media only screen and (max-width:620px) {
            .pc-header-box-s6 .pc-header-box-in {
                padding: 29px 16px 26px !important
            }

            .pc-header-logo-s1,
            .pc-header-nav-s1 {
                width: 100% !important
            }

            .pc-header-cta-s4 {
                text-align: center !important
            }

            .pc-footer-row-s1 .pc-footer-row-col,
            .pc-header-cta-s4 .pc-header-cta-col {
                max-width: 100% !important
            }

            .pc-header-cta-s4 .pc-header-cta-acs,
            .pc-header-cta-s4 .pc-header-cta-icon,
            .pc-header-cta-s4 .pc-header-cta-img {
                Margin: 0 auto !important
            }

            .pc-header-cta-s4 .pc-header-cta-text br,
            .pc-header-cta-s4 .pc-header-cta-title br {
                display: none !important
            }

            .pc-features-row-s1 .pc-features-row-col {
                max-width: 50% !important
            }

            .pc-cta-box-s14 .pc-cta-box-in {
                padding-bottom: 35px !important;
                padding-top: 35px !important
            }

            .pc-footer-box-s1 {
                padding-left: 10px !important;
                padding-right: 10px !important
            }

            .pc-spacing.pc-m-footer-h-46 td,
            .pc-spacing.pc-m-footer-h-57 td {
                font-size: 20px !important;
                height: 20px !important;
                line-height: 20px !important
            }
        }

        @media only screen and (max-width:525px) {
            .pc-header-box-s6 .pc-header-box-in {
                padding: 15px 6px 5px !important
            }

            .pc-spacing.pc-m-header-7 {
                font-size: 22px !important;
                height: 22px !important;
                line-height: 22px !important
            }

            .pc-cta-title br,
            .pc-footer-text-s1 br,
            .pc-header-cta-text br,
            .pc-header-cta-title br {
                display: none !important
            }

            .pc-features-row-s1 .pc-features-row-col {
                max-width: 100% !important
            }

            .pc-cta-box-s14 .pc-cta-box-in {
                padding: 25px 20px !important
            }

            .pc-cta-s1 .pc-cta-title {
                font-size: 24px !important;
                line-height: 1.42 !important
            }

            .pc-cta-icon.pc-m-module-18 {
                height: auto !important;
                width: 72px !important
            }

            .pc-footer-box-s1 {
                padding: 5px 0 !important
            }
        }
    </style>
    <!--[if mso]>
    <style type="text/css">
      .pc-fb-font{font-family:Helvetica,Arial,sans-serif !important;}
    </style>
    <![endif]-->
    <!--[if gte mso 9]>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
    <![endif]-->
</head>

<body class="pc-fb-font" bgcolor="#ffffff"
    style="background-color: #ffffff; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 16px; width: 100% !important; Margin: 0 !important; padding: 0; line-height: 1.5; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%">
    <table style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;" width="100%" border="0" cellpadding="0"
        cellspacing="0">
        <tbody>
            <tr>
                <td style="padding: 0; vertical-align: top;" align="center" valign="top">
                    <!--[if (gte mso 9)|(IE)]>
                    <table width="620" align="center" border="0" cellspacing="0" cellpadding="0"><tr><td width="620" align="center" valign="top">
                    <![endif]-->
                    <table class="pc-container" align="center"
                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; Margin: 0 auto; max-width: 620px;"
                        width="100%" border="0" cellpadding="0" cellspacing="0">
                        <tbody>
                            <tr>
                                <td align="left" style="vertical-align: top; padding: 0 10px;" valign="top">
                                    <table border="0" cellpadding="0" cellspacing="0"
                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;" width="100%">
                                        <tbody>
                                            <tr>
                                                <td style="vertical-align: top; padding: 0; height: 20px; font-size: 0px; line-height: 20px;"
                                                    valign="top">&nbsp;</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width:100%;" border="0"
                                        cellspacing="0" cellpadding="0" width="100%">
                                        <tbody>
                                            <tr>
                                                <td>

                                                    <!-- START MODULE: Feature 1 -->
                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                        width="100%">
                                                        <tbody>
                                                            <tr>
                                                                <td class="pc-features-box-s1"
                                                                    style="vertical-align: top; padding: 20px 20px; background-color: #2E3A30;"
                                                                    valign="top">
                                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                        width="100%">
                                                                        <tbody>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 700; line-height: 1.42; letter-spacing: -0.4px; color: #151515; padding: 0 20px;"
                                                                                    valign="top">



                                                                                    <img src="https://newbucketassets.s3.sa-east-1.amazonaws.com/logo.png"
                                                                                        alt="Group-3" border="0" style="
    width: 60px;
    margin: 0 auto;
    display: block;
    padding: 20px 0;
">
                                                                                </td>
                                                                            </tr>


                                                                        </tbody>
                                                                    </table>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                    <!-- END MODULE: Feature 1 -->
                                                    <!-- START MODULE: Feature 1 -->
                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                        width="100%">
                                                        <tbody>
                                                            <tr>
                                                                <td class="pc-features-box-s1"
                                                                    style="vertical-align: top; padding: 20px 20px; background-color: #fbfbfb;"
                                                                    valign="top">
                                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                        width="100%">
                                                                        <tbody>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 20px; font-size: 0px; line-height: 20px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 700; line-height: 1.42; letter-spacing: -0.4px; color: #424242; padding: 0 20px;text-align: center;">
                                                                                    New Lead Sprouted
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top;font-family: 'Montserrat', Helvetica, Arial, sans-serif;font-size: 14px;font-weight: 400;line-height: 1.42;letter-spacing: 0;color: #424242;padding: 10px 20px;text-align: center;">
                                                                                    Admin Alert • ${partnerCount}
                                                                                    Partner${
                                                                                      partnerCount >
                                                                                      1
                                                                                        ? "s"
                                                                                        : ""
                                                                                    } Notified
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 10px; font-size:0px; line-height: 10px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>

                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; text-align: center; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 600; line-height: 1.42; color: #424242;padding: 20px 20px 0 20px; ">
                                                                                    Immediate Attention Required

                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top;font-family: 'Montserrat', Helvetica, Arial, sans-serif;font-size: 14px;font-weight: 400;line-height: 1.42;letter-spacing: 0;color: #424242;padding: 10px 20px;text-align: center;">
                                                                                    ${
                                                                                      leadDetails?.timestamp ||
                                                                                      new Date().toLocaleString()
                                                                                    }
                                                                                </td>
                                                                            </tr>

                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 20px; font-size:0px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>


                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 10px; font-size: 0px; line-height: 10px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="  vertical-align: top; padding: 20px 20px; margin-top: 10px; display: block; border: 1px solid #2E3A302b; border-radius: 10px; background: #2E3A3012;"
                                                                                    valign="top" align="center">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;">
                                                                                        <tbody
                                                                                            style="vertical-align: top; border-radius: 8px; text-align: center; ">
                                                                                            <tr>
                                                                                                <td style="font-size: 15px;     font-weight: 600;
    color: #2E3A30; text-align: center; text-transform: uppercase;">
                                                                                                    Lead Growth Report
                                                                                                </td>
                                                                                            </tr>


                                                                                            <tr>
                                                                                                <td style="       font-size: 16px;
    font-weight: 400;
    color: #2E3A30;
    text-align: center;
    display: block;
    margin-top: 10px;
    border: 1px solid #2E3A303b;
    border-radius: 10px;
    background: #fff;
    padding: 10px 20px;
    ">
                                                                                                    <table border="0"
                                                                                                        cellpadding="0"
                                                                                                        cellspacing="0"
                                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;">
                                                                                                        <tbody
                                                                                                            style="vertical-align: top; border-radius: 8px; ">
                                                                                                            <tr>
                                                                                                                <td>
                                                                                                                    <p style="
    margin:  5px 0;
"> Lead Identifier
                                                                                                                    </p>

                                                                                                                </td>


                                                                                                            </tr>

                                                                                                            <tr>
                                                                                                                <td style="    vertical-align: top;
    font-family: 'Montserrat', Helvetica, Arial, sans-serif;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.42;
    letter-spacing: -0.4px;
    color: #424242;
    padding: 0 20px;
    text-align: center;" valign="top">${leadDetails?.leadId}
                                                                                                                </td>
                                                                                                            </tr>


                                                                                                        </tbody>
                                                                                                    </table>
                                                                                                </td>
                                                                                            </tr>


                                                                                            <tr>
                                                                                                <td style="       font-size: 16px;
    font-weight: 400;
    color: #2E3A30;
    text-align: center;
    display: block;
    margin-top: 10px;
    border: 1px solid #2E3A303b;
    border-radius: 10px;
    background: #fff;
    padding: 10px 20px;
    ">



                                                                                                    <p style="font-size: 15px;     font-weight: 600;
    color: #2E3A30; text-align: center; text-transform: uppercase;">
                                                                                                        Customer
                                                                                                        Information
                                                                                                    </p>



                                                                                                    <table border="0"
                                                                                                        cellpadding="0"
                                                                                                        cellspacing="0"
                                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;">
                                                                                                        <tbody
                                                                                                            style="vertical-align: top; border-radius: 8px; ">

                                                                                                            <tr>


                                                                                                                <td style="
    width: 158px;
">
                                                                                                                    <p style="
    margin:  5px 0;
"> Name
                                                                                                                    </p>

                                                                                                                </td>
                                                                                                                <td>
                                                                                                                    <p style="
    margin: 5px 0;
"> :
                                                                                                                    </p>

                                                                                                                </td>
                                                                                                                <td>
                                                                                                                    <p
                                                                                                                        style="font-weight: 600; margin:  5px 0; ">
                                                                                                                        ${userName}
                                                                                                                    </p>

                                                                                                                </td>
                                                                                                            </tr>
                                                                                                            <tr>
                                                                                                                <td>
                                                                                                                    <p style="
    margin:  5px 0;
"> Email
                                                                                                                    </p>

                                                                                                                </td>
                                                                                                                <td>
                                                                                                                    <p style="
    margin: 5px 0;
"> :
                                                                                                                    </p>

                                                                                                                </td>
                                                                                                                <td>
                                                                                                                    <p
                                                                                                                        style="font-weight: 600; margin:  5px 0; ">
                                                                                                                        <a href="#"
                                                                                                                            style="
    color: #2E3A30;
"> ${userEmail}</a>
                                                                                                                    </p>

                                                                                                                </td>
                                                                                                            </tr>
                                                                                                            <tr>
                                                                                                                <td>
                                                                                                                    <p style="
    margin:  5px 0;
"> Phone
                                                                                                                    </p>

                                                                                                                </td>
                                                                                                                <td>
                                                                                                                    <p style="
    margin: 5px 0;
"> :
                                                                                                                    </p>

                                                                                                                </td>
                                                                                                                <td>
                                                                                                                    <p
                                                                                                                        style="font-weight: 600; margin:  5px 0; ">
                                                                                                                        <a href="#"
                                                                                                                            style="
    color: #2E3A30;
"> ${leadDetails?.phone}</a>
                                                                                                                    </p>

                                                                                                                </td>
                                                                                                            </tr>
                                                                                                        </tbody>
                                                                                                    </table>
                                                                                                </td>
                                                                                            </tr>

                                                                                            <tr>
                                                                                                <td style="       font-size: 16px;
    font-weight: 400;
    color: #2E3A30;
    text-align: center;
    display: block;
    margin-top: 10px;
    border: 1px solid #2E3A303b;
    border-radius: 10px;
    background: #fff;
    padding: 10px 20px;
    ">
                                                                                                    <table border="0"
                                                                                                        cellpadding="0"
                                                                                                        cellspacing="0"
                                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;">
                                                                                                        <tbody
                                                                                                            style="vertical-align: top; border-radius: 8px; ">


                                                                                                            <tr>
                                                                                                                <td style="    vertical-align: top;
    font-family: 'Montserrat', Helvetica, Arial, sans-serif;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.42;
    letter-spacing: -0.4px;
    color: #424242;
    padding: 0 20px;
    text-align: center;" valign="top">Partner Information (${partnerCount} Partner${partnerCount > 1 ? "s" : ""})
                                                                                                                </td>
                                                                                                            </tr>


                                                                                                        </tbody>
                                                                                                    </table>
                                                                                                </td>
                                                                                            </tr>


                                                                                           <!-- Partner List Section - Add this after Partner Information heading -->
${partners
  .map(
    (partner, index) => `
<tr>
    <td style="font-size: 16px; font-weight: 400; color: #2E3A30; text-align: center; display: block; margin-top: 10px; border: 1px solid #2E3A303b; border-radius: 10px; background: #fff; padding: 10px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;">
            <tbody style="vertical-align: top; border-radius: 8px;">
                <tr>
                    <td style="width: 50px; text-align: left;">
                        <div style="display: inline-block; width: 32px; height: 32px; background: linear-gradient(135deg, #2E3A30 0%, #3d4f3f 100%); border-radius: 50%; text-align: center; line-height: 32px; font-weight: bold; color: #ffffff; font-size: 14px;">
                            ${index + 1}
                        </div>
                    </td>
                    <td style="text-align: left;">
                        <p style="font-weight: 600; margin: 2px 0; color: #2E3A30; font-size: 15px;">
                            ${partner.name}
                        </p>
                        <p style="margin: 2px 0; font-size: 13px;">
                            <a href="mailto:${partner.email}" style="color: #2E3A30; text-decoration: none; border-bottom: 1px solid #2E3A3050;">
                                ${partner.email}
                            </a>
                        </p>
                    </td>
                </tr>
            </tbody>
        </table>
    </td>
</tr>
`
  )
  .join("")}




                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 30px; font-size: 0px; line-height: 30px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                          <tr>
                                                                                <td style="vertical-align: top;" valign="top">
                                                                                    <table border="0" cellpadding="0" cellspacing="0" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;" width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="    vertical-align: top;
    font-family: 'Montserrat', Helvetica, Arial, sans-serif;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.42;
    letter-spacing: -0.4px;
    color: #424242;
    padding: 0 20px;" valign="top">Required Actions to Nurture This Lead
                                                                                                </td>
                                                                                            </tr>
                                                                                            <tr>
                                                                                <td style="vertical-align: top;" valign="top">
                                                                                    <table border="0" cellpadding="0" cellspacing="0" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;" width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 15px; font-size: 0px; line-height: 15px;" valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td class="pc-fb-font" style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 1.42; letter-spacing: -0.4px; color: #424242; padding: 0 20px; ">

                                                                                    <ul style="padding-left: 20px; margin-top: 0;">
                                                                                        <li>
                                                                                           Review complete lead details and requirements
                                                                                        </li>
                                                                                        <li>
                                                                                         Assign to appropriate team member for cultivation
                                                                                        </li>
                                                                                        <li>
                                                                                           Initiate customer contact within 24 hours
                                                                                        </li>
                                                                                        <li>
                                                                                             Update ${partnerCount > 1 ? "partners" : "partner"} on lead progression status
                                                                                        </li>
                                                                                    </ul>

                                                                                </td>
                                                                            </tr>

                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 15px; font-size: 0px; line-height: 15px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                                                                          <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 15px; font-size: 0px; line-height: 15px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                        </tbody>
                                                                    </table>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                    <!-- END MODULE: Feature 1 -->

                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                        width="100%">
                                                        <tbody>
                                                            <tr>
                                                                <td class="pc-features-box-s1"
                                                                    style="vertical-align: top; padding: 40px 20px; background-color: #2E3A30;"
                                                                    valign="top">
                                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                        width="100%">
                                                                        <tbody>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 1.62; letter-spacing: -0.4px; color: #ffffff; padding: 0 20px;text-align: center;"
                                                                                    align="center" valign="top">
                                                                                   Automated Admin Notification
                                                                                    <br>
                                                                                 Kasagardem Lead Growth Management System

                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top; height: 15px; font-size: 0px; line-height: 15px;"
                                                                                    valign="top">&nbsp;
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 1.62; letter-spacing: -0.4px; color: #ffffff; padding: 0 20px;text-align: center;"
                                                                                    align="center" valign="top">
                                                                                   © 2025 Kasagardem • Internal Use Only • Confidential
                                                                                   
                                                                                </td>
                                                                            </tr>


                                                                        </tbody>
                                                                    </table>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>



                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table border="0" cellpadding="0" cellspacing="0"
                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;" width="100%">
                                        <tbody>
                                            <tr>
                                                <td style="vertical-align: top; padding: 0; height: 20px; font-size: 20px; line-height: 20px;"
                                                    valign="top">&nbsp;</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <!--[if (gte mso 9)|(IE)]>
                    </td></tr></table>
                    <![endif]-->
                </td>
            </tr>
        </tbody>
    </table>
</body>

</html>
  `;
};
